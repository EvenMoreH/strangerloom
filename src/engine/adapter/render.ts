// Renders an NPC through a data-driven adapter pack: fields are formulas over the profile, evaluated in order.
import {
	COMPETENCIES,
	COMPETENCY_WORDS,
	type AdapterPack,
	type Npc,
	type Profile
} from '../schema';
import { isDice, normalizeDice } from '../dice';
import { GENERIC_CONDITIONS } from '../tracker';
import { attackLine, dots, type RenderOptions } from './generic';
import {
	BUILTINS,
	cap,
	compile,
	FormulaError,
	renderTemplate,
	words,
	type Functions,
	type Scope,
	type Value
} from './formula';
import type { StatBlock, StatLine, StatSection, TrackerHint } from './types';

export class AdapterError extends Error {
	constructor(
		message: string,
		readonly adapter: string,
		readonly field?: string
	) {
		super(
			field
				? `Adapter "${adapter}", field "${field}": ${message}`
				: `Adapter "${adapter}": ${message}`
		);
		this.name = 'AdapterError';
	}
}

const SECTION_LABELS: Record<string, string> = {
	header: 'Profile',
	defence: 'Defence',
	offence: 'Attacks',
	competencies: 'Competencies',
	abilities: 'Abilities',
	gear: 'Gear and loot',
	tactics: 'Tactics'
};

const USE_LABEL: Record<Profile['abilities'][number]['use'], string> = {
	passive: 'passive',
	'at-will': 'at will',
	'per-fight': 'once per fight',
	reaction: 'reaction'
};

const COINS_LABEL: Record<Profile['loot']['coins'], string> = {
	none: 'no coin',
	few: 'a few coins',
	modest: 'a modest purse',
	good: 'a good purse',
	rich: 'a rich purse'
};

/** The values a formula can read for an NPC. */
export function scopeOf(npc: Npc): Scope {
	const p = npc.profile;
	if (!p) throw new Error('The NPC has no profile to render.');
	return {
		name: npc.narrative.name.full,
		tier: npc.tier,
		archetype: p.archetype,
		archetypeLabel: p.archetypeLabel,
		threat: p.threat,
		power: p.power,
		role: p.role,
		defence: p.defence,
		tags: p.tags,
		competencies: { ...p.competencies },
		attackCount: p.attacks.length,
		abilityCount: p.abilities.length
	};
}

function lookupIn(pack: AdapterPack, name: string, keys: Value[]): Value {
	const table = pack.lookups[name];
	if (!table) throw new Error(`Unknown lookup "${name}"`);
	if (keys.length !== table.by.length) {
		throw new Error(`Lookup "${name}" takes ${table.by.length} keys (${table.by.join(', ')})`);
	}
	const base = table.base ?? 1;
	let node: unknown = table.rows;
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (Array.isArray(node)) {
			const n = typeof key === 'number' ? key : Number(key);
			if (!Number.isFinite(n)) throw new Error(`Lookup "${name}": "${key}" is not an index`);
			const idx = Math.min(node.length - 1, Math.max(0, Math.round(n) - base));
			node = node[idx];
		} else if (node && typeof node === 'object') {
			const row = (node as Record<string, unknown>)[String(key)];
			if (row === undefined) throw new Error(`Lookup "${name}" has no row "${key}"`);
			node = row;
		} else {
			throw new Error(`Lookup "${name}" ends before key "${table.by[i]}"`);
		}
	}
	if (typeof node === 'number' || typeof node === 'string' || typeof node === 'boolean')
		return node;
	throw new Error(`Lookup "${name}" did not reach a value`);
}

function functionsFor(pack: AdapterPack, npc: Npc): Functions {
	const tags = new Set(npc.profile?.tags ?? []);
	return {
		...BUILTINS,
		lookup: ([name, ...keys]) => lookupIn(pack, String(name), keys),
		has: ([tag]) => tags.has(String(tag))
	};
}

function sectionList(pack: AdapterPack): StatSection[] {
	return pack.sections.map((s) => {
		const id = typeof s === 'string' ? s : s.id;
		const label =
			(typeof s === 'string' ? undefined : s.label) ??
			pack.labels[id] ??
			SECTION_LABELS[id] ??
			words(id);
		return { id, label, lines: [] };
	});
}

/** Renders an NPC with a data-driven adapter. Throws `AdapterError` on a bad formula or lookup. */
export function renderAdapter(pack: AdapterPack, npc: Npc, options: RenderOptions = {}): StatBlock {
	const p = npc.profile;
	if (!p) throw new Error('The NPC has no profile to render.');
	const fns = functionsFor(pack, npc);
	const scope = scopeOf(npc);
	const sections = sectionList(pack);
	const byId = new Map(sections.map((s) => [s.id, s]));
	const section = (id: string): StatSection => {
		let s = byId.get(id);
		if (!s) {
			s = { id, label: pack.labels[id] ?? SECTION_LABELS[id] ?? words(id), lines: [] };
			byId.set(id, s);
			sections.push(s);
		}
		return s;
	};
	const wrap = <T>(field: string | undefined, run: () => T): T => {
		try {
			return run();
		} catch (err) {
			if (err instanceof AdapterError) throw err;
			const message = err instanceof FormulaError ? err.message : (err as Error).message;
			throw new AdapterError(message, pack.id, field);
		}
	};

	const values: Record<string, Value> = {};
	for (const field of pack.fields) {
		const value = wrap(field.id, () => compile(field.formula).evaluate(scope, fns));
		values[field.id] = value;
		scope[field.id] = value;
		if (field.hidden) continue;
		if (field.when && !wrap(field.id, () => compile(field.when!).evaluate(scope, fns))) continue;
		const local = { ...scope, value };
		const line: StatLine = {
			id: field.id,
			label: field.label ?? pack.labels[field.id] ?? cap(field.id),
			value: wrap(field.id, () =>
				field.format ? renderTemplate(field.format, local, fns) : String(value)
			)
		};
		if (field.roll) {
			const rollText = String(wrap(field.id, () => compile(field.roll!).evaluate(local, fns)));
			if (!isDice(rollText)) {
				throw new AdapterError(`"${rollText}" is not a dice expression`, pack.id, field.id);
			}
			line.roll = normalizeDice(rollText);
		}
		if (field.note) line.note = wrap(field.id, () => renderTemplate(field.note!, local, fns));
		section(field.section ?? 'header').lines.push(line);
	}

	if (byId.has('competencies')) {
		const sec = section('competencies');
		const cfg = pack.competencies;
		for (const k of COMPETENCIES) {
			const rating = p.competencies[k];
			const word = COMPETENCY_WORDS[rating];
			if (!cfg) {
				sec.lines.push({ id: k, label: cap(k), value: dots(rating), note: word });
				continue;
			}
			const value = cfg.scale ? cfg.scale[rating] : rating;
			const local = { ...scope, value, rating, word, competency: k };
			const skills = cfg.skills?.[k];
			sec.lines.push({
				id: k,
				label: cap(k),
				value: wrap('competencies', () =>
					cfg.format ? renderTemplate(cfg.format, local, fns) : String(value)
				),
				...(skills?.length ? { note: skills.join(', ') } : {})
			});
		}
		if (cfg?.label) sec.label = cfg.label;
	}

	if (byId.has('offence')) {
		const sec = section('offence');
		p.attacks.forEach((a, i) => {
			const local: Scope = {
				...scope,
				attackName: a.name,
				kind: a.kind,
				use: a.use,
				range: a.range,
				damageClass: a.damage,
				damageType: a.damageType ?? 'physical',
				rider: a.rider ?? '',
				trigger: a.trigger ?? ''
			};
			const render = (template: string | undefined) =>
				template === undefined
					? undefined
					: wrap(`attack ${a.name}`, () => renderTemplate(template, local, fns));
			const base = attackLine(a, i, options.anchors);
			const toHit = render(pack.attack.toHit);
			const damage = render(pack.attack.damage);
			const type = a.damageType ? `, ${a.damageType}` : '';
			const parts = [
				toHit ? `${toHit} to hit` : undefined,
				damage ? `${damage}${type} damage` : undefined
			].filter((x): x is string => x !== undefined);
			const line: StatLine = {
				...base,
				value:
					render(pack.attack.value) ??
					(parts.length ? `${cap(a.kind)}, ${a.range}. ${parts.join(', ')}.` : base.value),
				note: render(pack.attack.note) ?? base.note,
				attack: {
					...base.attack!,
					...(toHit ? { toHit } : {}),
					...(damage ? { damage } : {})
				}
			};
			const rollText = render(pack.attack.roll) ?? damage;
			if (rollText !== undefined && isDice(rollText)) line.roll = normalizeDice(rollText);
			sec.lines.push(line);
		});
	}

	if (byId.has('abilities')) {
		const sec = section('abilities');
		for (const a of p.abilities) {
			const replacement = pack.abilities[a.id];
			sec.lines.push({
				id: a.id,
				label: replacement?.name ?? a.name,
				value: USE_LABEL[a.use],
				note: replacement?.text ?? a.text
			});
		}
	}

	if (byId.has('gear')) {
		const sec = section('gear');
		sec.lines.push(
			{ id: 'gear', label: pack.labels.gear ?? 'Gear', value: p.gear.join(', ') },
			{
				id: 'loot',
				label: pack.labels.loot ?? 'Loot',
				value: [COINS_LABEL[p.loot.coins], ...p.loot.items].join('; ')
			}
		);
	}

	if (byId.has('tactics')) {
		section('tactics').lines.push({ id: 'tactics', value: cap(p.tactics) });
	}

	const subtitle = wrap('subtitle', () =>
		pack.subtitle
			? renderTemplate(pack.subtitle, scope, fns)
			: `${p.archetypeLabel} | ${cap(p.threat)} | power ${p.power}`
	);

	const tracker: TrackerHint = { conditions: pack.tracker.conditions ?? [...GENERIC_CONDITIONS] };
	if (pack.tracker.hp) {
		const hp = values[pack.tracker.hp];
		if (typeof hp !== 'number') {
			throw new AdapterError(
				`tracker.hp points at "${pack.tracker.hp}", which is not a number`,
				pack.id
			);
		}
		tracker.hpMax = Math.max(0, Math.round(hp));
		tracker.hpLine = pack.tracker.hp;
	}
	if (pack.tracker.hpRoll) {
		const line = sections.flatMap((s) => s.lines).find((l) => l.id === pack.tracker.hpRoll);
		if (!line?.roll) {
			throw new AdapterError(
				`tracker.hpRoll points at "${pack.tracker.hpRoll}", which has no roll`,
				pack.id
			);
		}
		tracker.hpRoll = line.roll;
	}
	if (pack.tracker.initiative) {
		const text = String(
			wrap('tracker.initiative', () => compile(pack.tracker.initiative!).evaluate(scope, fns))
		);
		if (!isDice(text))
			throw new AdapterError(`initiative "${text}" is not a dice expression`, pack.id);
		tracker.initiative = normalizeDice(text);
	}

	return {
		adapter: pack.id,
		adapterVersion: pack.version,
		title: npc.narrative.name.full,
		subtitle,
		sections: sections.filter((s) => s.lines.length > 0 || byId.has(s.id)),
		tracker
	};
}
