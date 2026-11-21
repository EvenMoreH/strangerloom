// The adapter formula language: a small expression grammar evaluated against a scope of profile values.
// Numbers, strings, booleans; + - * / %; comparisons; `? :`; and, or, not; a fixed set of functions. No code execution.

export type Value = number | string | boolean;
export type Scope = Record<string, unknown>;

export class FormulaError extends Error {
	constructor(
		message: string,
		readonly expression: string,
		readonly position?: number
	) {
		super(position === undefined ? message : `${message} at ${position} in "${expression}"`);
		this.name = 'FormulaError';
	}
}

type Node =
	| { t: 'num'; v: number }
	| { t: 'str'; v: string }
	| { t: 'id'; name: string; pos: number }
	| { t: 'un'; op: '-' | 'not'; a: Node; pos: number }
	| { t: 'bin'; op: string; a: Node; b: Node; pos: number }
	| { t: 'and' | 'or'; a: Node; b: Node }
	| { t: 'cond'; c: Node; a: Node; b: Node }
	| { t: 'call'; name: string; args: Node[]; pos: number };

type Token =
	| { k: 'num'; v: number; pos: number }
	| { k: 'str'; v: string; pos: number }
	| { k: 'id'; v: string; pos: number }
	| { k: 'op'; v: string; pos: number }
	| { k: 'end'; pos: number };

const OPS = [
	'==',
	'!=',
	'<=',
	'>=',
	'&&',
	'||',
	'+',
	'-',
	'*',
	'/',
	'%',
	'<',
	'>',
	'(',
	')',
	',',
	'?',
	':',
	'!'
];
const ID_START = /[A-Za-z_]/;
const ID_PART = /[A-Za-z0-9_.]/;

function tokenize(src: string): Token[] {
	const out: Token[] = [];
	let i = 0;
	while (i < src.length) {
		const ch = src[i];
		if (/\s/.test(ch)) {
			i++;
			continue;
		}
		const pos = i;
		if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
			let j = i;
			while (j < src.length && /[0-9.]/.test(src[j])) j++;
			const text = src.slice(i, j);
			const v = Number(text);
			if (!Number.isFinite(v)) throw new FormulaError(`Bad number "${text}"`, src, pos);
			out.push({ k: 'num', v, pos });
			i = j;
			continue;
		}
		if (ch === "'" || ch === '"') {
			let j = i + 1;
			let v = '';
			while (j < src.length && src[j] !== ch) {
				if (src[j] === '\\' && j + 1 < src.length) j++;
				v += src[j++];
			}
			if (j >= src.length) throw new FormulaError('Unterminated string', src, pos);
			out.push({ k: 'str', v, pos });
			i = j + 1;
			continue;
		}
		if (ID_START.test(ch)) {
			let j = i;
			while (j < src.length && ID_PART.test(src[j])) j++;
			out.push({ k: 'id', v: src.slice(i, j), pos });
			i = j;
			continue;
		}
		const op = OPS.find((o) => src.startsWith(o, i));
		if (!op) throw new FormulaError(`Unexpected character "${ch}"`, src, pos);
		out.push({ k: 'op', v: op, pos });
		i += op.length;
	}
	out.push({ k: 'end', pos: src.length });
	return out;
}

class Parser {
	private i = 0;
	constructor(
		private tokens: Token[],
		private src: string
	) {}

	parse(): Node {
		const node = this.conditional();
		const t = this.peek();
		if (t.k !== 'end') throw new FormulaError(`Unexpected "${this.text(t)}"`, this.src, t.pos);
		return node;
	}

	private peek(): Token {
		return this.tokens[this.i];
	}
	private next(): Token {
		return this.tokens[this.i++];
	}
	private text(t: Token): string {
		return t.k === 'end' ? 'end of expression' : String(t.v);
	}
	private isOp(v: string): boolean {
		const t = this.peek();
		return t.k === 'op' && t.v === v;
	}
	private isWord(v: string): boolean {
		const t = this.peek();
		return t.k === 'id' && t.v === v;
	}
	private expectOp(v: string) {
		const t = this.next();
		if (t.k !== 'op' || t.v !== v) {
			throw new FormulaError(`Expected "${v}" but found "${this.text(t)}"`, this.src, t.pos);
		}
	}

	private conditional(): Node {
		const c = this.or();
		if (!this.isOp('?')) return c;
		this.next();
		const a = this.conditional();
		this.expectOp(':');
		const b = this.conditional();
		return { t: 'cond', c, a, b };
	}

	private or(): Node {
		let a = this.and();
		while (this.isWord('or') || this.isOp('||')) {
			this.next();
			a = { t: 'or', a, b: this.and() };
		}
		return a;
	}

	private and(): Node {
		let a = this.equality();
		while (this.isWord('and') || this.isOp('&&')) {
			this.next();
			a = { t: 'and', a, b: this.equality() };
		}
		return a;
	}

	private equality(): Node {
		let a = this.comparison();
		while (this.isOp('==') || this.isOp('!=')) {
			const op = this.next() as Token & { k: 'op' };
			a = { t: 'bin', op: op.v, a, b: this.comparison(), pos: op.pos };
		}
		return a;
	}

	private comparison(): Node {
		let a = this.additive();
		while (this.isOp('<') || this.isOp('<=') || this.isOp('>') || this.isOp('>=')) {
			const op = this.next() as Token & { k: 'op' };
			a = { t: 'bin', op: op.v, a, b: this.additive(), pos: op.pos };
		}
		return a;
	}

	private additive(): Node {
		let a = this.multiplicative();
		while (this.isOp('+') || this.isOp('-')) {
			const op = this.next() as Token & { k: 'op' };
			a = { t: 'bin', op: op.v, a, b: this.multiplicative(), pos: op.pos };
		}
		return a;
	}

	private multiplicative(): Node {
		let a = this.unary();
		while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
			const op = this.next() as Token & { k: 'op' };
			a = { t: 'bin', op: op.v, a, b: this.unary(), pos: op.pos };
		}
		return a;
	}

	private unary(): Node {
		const t = this.peek();
		if (t.k === 'op' && t.v === '-') {
			this.next();
			return { t: 'un', op: '-', a: this.unary(), pos: t.pos };
		}
		if ((t.k === 'op' && t.v === '!') || (t.k === 'id' && t.v === 'not')) {
			this.next();
			return { t: 'un', op: 'not', a: this.unary(), pos: t.pos };
		}
		return this.primary();
	}

	private primary(): Node {
		const t = this.next();
		if (t.k === 'num') return { t: 'num', v: t.v };
		if (t.k === 'str') return { t: 'str', v: t.v };
		if (t.k === 'op' && t.v === '(') {
			const inner = this.conditional();
			this.expectOp(')');
			return inner;
		}
		if (t.k === 'id') {
			if (t.v === 'true') return { t: 'num', v: 1 };
			if (t.v === 'false') return { t: 'num', v: 0 };
			if (this.isOp('(')) {
				this.next();
				const args: Node[] = [];
				if (!this.isOp(')')) {
					args.push(this.conditional());
					while (this.isOp(',')) {
						this.next();
						args.push(this.conditional());
					}
				}
				this.expectOp(')');
				return { t: 'call', name: t.v, args, pos: t.pos };
			}
			return { t: 'id', name: t.v, pos: t.pos };
		}
		throw new FormulaError(`Unexpected "${this.text(t)}"`, this.src, t.pos);
	}
}

/** A compiled expression. */
export interface Formula {
	readonly source: string;
	evaluate(scope: Scope, functions?: Functions): Value;
}

export type FormulaFunction = (args: Value[], scope: Scope) => Value;
export type Functions = Record<string, FormulaFunction>;

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const words = (s: string) => cap(s.replace(/-/g, ' '));
export const signed = (n: number) => (n < 0 ? String(n) : `+${n}`);

const num = (v: Value, what: string): number => {
	if (typeof v === 'boolean') return v ? 1 : 0;
	if (typeof v !== 'number') throw new Error(`${what} needs a number, not "${v}"`);
	return v;
};

/** Functions every formula can call. Adapters add `lookup` and `has` through the renderer. */
export const BUILTINS: Functions = {
	floor: ([a]) => Math.floor(num(a, 'floor')),
	ceil: ([a]) => Math.ceil(num(a, 'ceil')),
	round: ([a]) => Math.round(num(a, 'round')),
	abs: ([a]) => Math.abs(num(a, 'abs')),
	max: (args) => Math.max(...args.map((a) => num(a, 'max'))),
	min: (args) => Math.min(...args.map((a) => num(a, 'min'))),
	clamp: ([a, lo, hi]) => Math.min(Math.max(num(a, 'clamp'), num(lo, 'clamp')), num(hi, 'clamp')),
	signed: ([a]) => signed(num(a, 'signed')),
	cap: ([a]) => cap(String(a)),
	words: ([a]) => words(String(a)),
	str: ([a]) => String(a),
	len: ([a]) => String(a).length
};

const truthy = (v: Value): boolean =>
	typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v.length > 0;

function resolve(scope: Scope, name: string, src: string, pos: number): Value {
	let cur: unknown = scope;
	for (const part of name.split('.')) {
		if (cur === null || typeof cur !== 'object' || !Object.hasOwn(cur, part)) {
			throw new FormulaError(`Unknown name "${name}"`, src, pos);
		}
		cur = (cur as Record<string, unknown>)[part];
	}
	if (typeof cur === 'number' || typeof cur === 'string' || typeof cur === 'boolean') return cur;
	if (Array.isArray(cur)) return cur.map(String).join(', ');
	throw new FormulaError(`"${name}" is not a value`, src, pos);
}

function evalNode(n: Node, scope: Scope, fns: Functions, src: string): Value {
	switch (n.t) {
		case 'num':
		case 'str':
			return n.v;
		case 'id':
			return resolve(scope, n.name, src, n.pos);
		case 'un': {
			const a = evalNode(n.a, scope, fns, src);
			if (n.op === 'not') return !truthy(a);
			if (typeof a !== 'number') throw new FormulaError('Unary minus needs a number', src, n.pos);
			return -a;
		}
		case 'and': {
			const a = evalNode(n.a, scope, fns, src);
			return truthy(a) ? truthy(evalNode(n.b, scope, fns, src)) : false;
		}
		case 'or': {
			const a = evalNode(n.a, scope, fns, src);
			return truthy(a) ? true : truthy(evalNode(n.b, scope, fns, src));
		}
		case 'cond':
			return truthy(evalNode(n.c, scope, fns, src))
				? evalNode(n.a, scope, fns, src)
				: evalNode(n.b, scope, fns, src);
		case 'bin': {
			const a = evalNode(n.a, scope, fns, src);
			const b = evalNode(n.b, scope, fns, src);
			switch (n.op) {
				case '==':
					return a === b || (typeof a !== typeof b && String(a) === String(b));
				case '!=':
					return !(a === b || (typeof a !== typeof b && String(a) === String(b)));
				case '+':
					if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
					return num(a, '+') + num(b, '+');
			}
			if (typeof a === 'string' && typeof b === 'string') {
				switch (n.op) {
					case '<':
						return a < b;
					case '<=':
						return a <= b;
					case '>':
						return a > b;
					case '>=':
						return a >= b;
				}
			}
			let x: number;
			let y: number;
			try {
				x = num(a, n.op);
				y = num(b, n.op);
			} catch (err) {
				throw new FormulaError((err as Error).message, src, n.pos);
			}
			switch (n.op) {
				case '-':
					return x - y;
				case '*':
					return x * y;
				case '/':
					if (y === 0) throw new FormulaError('Division by zero', src, n.pos);
					return x / y;
				case '%':
					if (y === 0) throw new FormulaError('Division by zero', src, n.pos);
					return x % y;
				case '<':
					return x < y;
				case '<=':
					return x <= y;
				case '>':
					return x > y;
				case '>=':
					return x >= y;
			}
			throw new FormulaError(`Unknown operator "${n.op}"`, src, n.pos);
		}
		case 'call': {
			const fn = Object.hasOwn(fns, n.name) ? fns[n.name] : undefined;
			if (!fn) throw new FormulaError(`Unknown function "${n.name}"`, src, n.pos);
			const args = n.args.map((a) => evalNode(a, scope, fns, src));
			try {
				return fn(args, scope);
			} catch (err) {
				if (err instanceof FormulaError) throw err;
				throw new FormulaError((err as Error).message, src, n.pos);
			}
		}
	}
}

const cache = new Map<string, Node>();

/** Parses an expression once; the result evaluates against any scope. */
export function compile(source: string): Formula {
	let node = cache.get(source);
	if (!node) {
		node = new Parser(tokenize(source), source).parse();
		cache.set(source, node);
	}
	const ast = node;
	return {
		source,
		evaluate: (scope, functions = BUILTINS) => evalNode(ast, scope, functions, source)
	};
}

/** Parses and evaluates in one step. */
export function evaluate(source: string, scope: Scope, functions: Functions = BUILTINS): Value {
	return compile(source).evaluate(scope, functions);
}

/** Replaces every `{expression}` in a template with its value. `{{` and `}}` are literal braces. */
export function renderTemplate(
	template: string,
	scope: Scope,
	functions: Functions = BUILTINS
): string {
	let out = '';
	let i = 0;
	while (i < template.length) {
		const ch = template[i];
		if (ch === '{') {
			if (template[i + 1] === '{') {
				out += '{';
				i += 2;
				continue;
			}
			let depth = 1;
			let j = i + 1;
			while (j < template.length && depth > 0) {
				if (template[j] === '{') depth++;
				else if (template[j] === '}') depth--;
				if (depth > 0) j++;
			}
			if (depth > 0) throw new FormulaError('Unclosed "{" in template', template, i);
			out += String(evaluate(template.slice(i + 1, j), scope, functions));
			i = j + 1;
			continue;
		}
		if (ch === '}' && template[i + 1] === '}') {
			out += '}';
			i += 2;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
}
