// Dice expressions: `NdM`, `+`/`-` terms, `khN`/`klN` keep, `dhN`/`dlN` drop, `!` explode, `d%` percentile.
import type { Rng } from './rng';

export class DiceError extends Error {
	constructor(
		message: string,
		readonly expression: string
	) {
		super(`${message} in "${expression}"`);
		this.name = 'DiceError';
	}
}

export type KeepMode = 'kh' | 'kl' | 'dh' | 'dl';

export interface DiceTerm {
	kind: 'dice';
	sign: 1 | -1;
	count: number;
	sides: number;
	keep?: { mode: KeepMode; n: number };
	explode: boolean;
}

export interface ConstTerm {
	kind: 'const';
	sign: 1 | -1;
	value: number;
}

export type Term = DiceTerm | ConstTerm;

export interface DiceExpression {
	/** The expression in canonical spelling: lower case, no spaces, `d%` as `d100`. */
	text: string;
	terms: Term[];
}

export interface RolledDice extends DiceTerm {
	/** Every die rolled, explosions included, in order. */
	rolls: number[];
	/** Which rolls count towards the total. */
	kept: boolean[];
	subtotal: number;
}

export interface RolledConst extends ConstTerm {
	subtotal: number;
}

export interface RollResult {
	expression: string;
	terms: (RolledDice | RolledConst)[];
	total: number;
	/** `[14, 3] + 5 = 22` */
	breakdown: string;
}

export const MAX_DICE = 100;
export const MAX_SIDES = 1000;
const MAX_EXPLOSIONS = 100;

const TERM = /^(\d*)d(\d+|%)((?:k[hl]?\d+|d[hl]\d+|!)*)$|^(\d+)$/i;

/** Parses a dice expression. Throws `DiceError` when it is not one. */
export function parseDice(input: string): DiceExpression {
	const src = input.trim();
	const compact = src.replace(/\s+/g, '').toLowerCase();
	if (!compact) throw new DiceError('Empty expression', input);
	const terms: Term[] = [];
	let i = 0;
	let sign: 1 | -1 = 1;
	if (compact[0] === '+' || compact[0] === '-') {
		sign = compact[0] === '-' ? -1 : 1;
		i = 1;
	}
	while (i < compact.length) {
		let j = i;
		while (j < compact.length && compact[j] !== '+' && compact[j] !== '-') j++;
		const part = compact.slice(i, j);
		const m = TERM.exec(part);
		if (!m) throw new DiceError(`Bad term "${part}"`, input);
		if (m[4] !== undefined) {
			terms.push({ kind: 'const', sign, value: Number(m[4]) });
		} else {
			const count = m[1] === '' ? 1 : Number(m[1]);
			const sides = m[2] === '%' ? 100 : Number(m[2]);
			if (count < 1 || count > MAX_DICE) throw new DiceError(`Roll 1 to ${MAX_DICE} dice`, input);
			if (sides < 1 || sides > MAX_SIDES)
				throw new DiceError(`Dice have 1 to ${MAX_SIDES} sides`, input);
			const term: DiceTerm = { kind: 'dice', sign, count, sides, explode: false };
			for (const mod of m[3].match(/k[hl]?\d+|d[hl]\d+|!/g) ?? []) {
				if (mod === '!') {
					if (sides === 1) throw new DiceError('A one-sided die cannot explode', input);
					term.explode = true;
					continue;
				}
				const mode = (mod[0] === 'k' && !/[hl]/.test(mod[1]) ? 'kh' : mod.slice(0, 2)) as KeepMode;
				const n = Number(mod.replace(/^[kd][hl]?/, ''));
				if (term.keep) throw new DiceError('One keep or drop per term', input);
				if (n < 1 || n > count) throw new DiceError(`Keep or drop 1 to ${count} dice`, input);
				term.keep = { mode, n };
			}
			terms.push(term);
		}
		if (j < compact.length) {
			sign = compact[j] === '-' ? -1 : 1;
			j++;
			if (j >= compact.length) throw new DiceError('Dangling operator', input);
		}
		i = j;
	}
	return { text: terms.map(termText).join(''), terms };
}

function termText(term: Term, index = 1): string {
	const signText = term.sign === -1 ? '-' : '+';
	const body =
		term.kind === 'const'
			? String(term.value)
			: `${term.count}d${term.sides}${term.keep ? term.keep.mode + term.keep.n : ''}${term.explode ? '!' : ''}`;
	return `${signText}${body}`.replace(/^\+/, index === 0 ? '' : '+');
}

/** Whether a string is a dice expression. */
export function isDice(input: string): boolean {
	try {
		parseDice(input);
		return true;
	} catch {
		return false;
	}
}

/** Canonical spelling of an expression, or the input unchanged when it is not one. */
export function normalizeDice(input: string): string {
	try {
		const { terms } = parseDice(input);
		return terms.map((t, i) => termText(t, i)).join('');
	} catch {
		return input;
	}
}

const defaultRng: Rng = () => Math.random();

/** Rolls an expression. `rng` returns floats in [0, 1); the default is `Math.random`. */
export function roll(input: string | DiceExpression, rng: Rng = defaultRng): RollResult {
	const expr = typeof input === 'string' ? parseDice(input) : input;
	const die = (sides: number) => 1 + Math.floor(rng() * sides);
	const terms = expr.terms.map((term): RolledDice | RolledConst => {
		if (term.kind === 'const') return { ...term, subtotal: term.sign * term.value };
		const rolls: number[] = [];
		let pending = term.count;
		let explosions = 0;
		while (pending > 0) {
			const v = die(term.sides);
			rolls.push(v);
			pending--;
			if (term.explode && v === term.sides && explosions < MAX_EXPLOSIONS) {
				pending++;
				explosions++;
			}
		}
		const kept = rolls.map(() => true);
		if (term.keep) {
			const order = rolls
				.map((v, i) => ({ v, i }))
				.sort((a, b) => a.v - b.v || a.i - b.i)
				.map((x) => x.i);
			const { mode, n } = term.keep;
			const dropIdx =
				mode === 'kh'
					? order.slice(0, rolls.length - n)
					: mode === 'kl'
						? order.slice(n)
						: mode === 'dh'
							? order.slice(rolls.length - n)
							: order.slice(0, n);
			for (const i of dropIdx) kept[i] = false;
		}
		const subtotal = term.sign * rolls.reduce((sum, v, i) => sum + (kept[i] ? v : 0), 0);
		return { ...term, rolls, kept, subtotal };
	});
	const total = terms.reduce((sum, t) => sum + t.subtotal, 0);
	const breakdown =
		terms
			.map((t, i) => {
				const signText = t.sign === -1 ? '- ' : i === 0 ? '' : '+ ';
				if (t.kind === 'const') return `${signText}${t.value}`;
				const dice = t.rolls.map((v, k) => (t.kept[k] ? String(v) : `(${v})`)).join(', ');
				return `${signText}[${dice}]`;
			})
			.join(' ') + ` = ${total}`;
	return { expression: expr.terms.map((t, i) => termText(t, i)).join(''), terms, total, breakdown };
}

export interface RollLogEntry extends RollResult {
	id: number;
	/** What was rolled: an attack name, "Hit points", or nothing for a bare roll. */
	label?: string;
	at: number;
}

export const ROLL_LOG_SIZE = 50;

/** The log keeps the newest first and at most `size` entries. */
export function appendRoll(
	log: readonly RollLogEntry[],
	entry: RollLogEntry,
	size = ROLL_LOG_SIZE
): RollLogEntry[] {
	return [entry, ...log].slice(0, size);
}
