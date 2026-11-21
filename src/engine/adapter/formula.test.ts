import { describe, expect, it } from 'vitest';
import { compile, evaluate, FormulaError, renderTemplate } from './formula';

const scope = {
	power: 5,
	threat: 'standard',
	defence: 'hard-to-hit',
	competencies: { combat: 3, magic: 0 },
	tags: ['armoured', 'ranged'],
	flag: true
};

describe('formula', () => {
	it('does arithmetic with precedence and parentheses', () => {
		expect(evaluate('1 + 2 * 3', scope)).toBe(7);
		expect(evaluate('(1 + 2) * 3', scope)).toBe(9);
		expect(evaluate('10 / 4', scope)).toBe(2.5);
		expect(evaluate('7 % 3', scope)).toBe(1);
		expect(evaluate('-power + 2', scope)).toBe(-3);
		expect(evaluate('2 - -2', scope)).toBe(4);
	});

	it('reads scope values and dotted paths', () => {
		expect(evaluate('power', scope)).toBe(5);
		expect(evaluate('competencies.combat * 2', scope)).toBe(6);
		expect(evaluate('threat', scope)).toBe('standard');
		expect(evaluate('tags', scope)).toBe('armoured, ranged');
	});

	it('compares numbers and strings', () => {
		expect(evaluate('power >= 5', scope)).toBe(true);
		expect(evaluate('power < 5', scope)).toBe(false);
		expect(evaluate("threat == 'standard'", scope)).toBe(true);
		expect(evaluate('threat != "boss"', scope)).toBe(true);
		expect(evaluate("'5' == 5", scope)).toBe(true);
		expect(evaluate("'a' < 'b'", scope)).toBe(true);
	});

	it('has ternaries and boolean operators', () => {
		expect(evaluate("defence == 'hard-to-hit' ? 2 : 0", scope)).toBe(2);
		expect(evaluate('power > 3 and power < 7 ? "mid" : "edge"', scope)).toBe('mid');
		expect(evaluate('power > 9 or flag', scope)).toBe(true);
		expect(evaluate('not flag', scope)).toBe(false);
		expect(evaluate('!(power > 1) || power == 5', scope)).toBe(true);
		expect(evaluate('power > 3 ? power > 4 ? "a" : "b" : "c"', scope)).toBe('a');
	});

	it('short-circuits and/or', () => {
		expect(evaluate('false and unknown', scope)).toBe(false);
		expect(evaluate('true or unknown', scope)).toBe(true);
	});

	it('calls the built-in functions', () => {
		expect(evaluate('floor(power / 2)', scope)).toBe(2);
		expect(evaluate('ceil(power / 2)', scope)).toBe(3);
		expect(evaluate('round(2.5)', scope)).toBe(3);
		expect(evaluate('abs(-4)', scope)).toBe(4);
		expect(evaluate('max(1, power, 3)', scope)).toBe(5);
		expect(evaluate('min(1, power, 3)', scope)).toBe(1);
		expect(evaluate('clamp(power * 3, 0, 10)', scope)).toBe(10);
		expect(evaluate('signed(3)', scope)).toBe('+3');
		expect(evaluate('signed(-1)', scope)).toBe('-1');
		expect(evaluate('signed(0)', scope)).toBe('+0');
		expect(evaluate('cap(threat)', scope)).toBe('Standard');
		expect(evaluate('words(defence)', scope)).toBe('Hard to hit');
		expect(evaluate('str(power) + "x"', scope)).toBe('5x');
		expect(evaluate('len("abc")', scope)).toBe(3);
	});

	it('concatenates when a side is a string', () => {
		expect(evaluate("'power ' + power", scope)).toBe('power 5');
		expect(evaluate("'1d' + (power * 2)", scope)).toBe('1d10');
	});

	it('accepts extra functions', () => {
		const fns = { double: ([a]: (number | string | boolean)[]) => Number(a) * 2 };
		expect(evaluate('double(power)', scope, { ...fns })).toBe(10);
	});

	it('rejects unknown names, functions and syntax', () => {
		expect(() => evaluate('nope', scope)).toThrow(FormulaError);
		expect(() => evaluate('nope', scope)).toThrow(/Unknown name "nope"/);
		expect(() => evaluate('eval("1")', scope)).toThrow(/Unknown function "eval"/);
		expect(() => evaluate('1 +', scope)).toThrow(FormulaError);
		expect(() => evaluate('(1 + 2', scope)).toThrow(/Expected "\)"/);
		expect(() => evaluate('1 2', scope)).toThrow(/Unexpected "2"/);
		expect(() => evaluate("'open", scope)).toThrow(/Unterminated/);
		expect(() => evaluate('1 / 0', scope)).toThrow(/Division by zero/);
		expect(() => evaluate('a # b', scope)).toThrow(/Unexpected character/);
		expect(() => evaluate('"a" - 1', scope)).toThrow(/needs a number/);
		expect(() => evaluate('competencies', scope)).toThrow(/not a value/);
		expect(() => evaluate('competencies.nope', scope)).toThrow(/Unknown name/);
	});

	it('cannot reach the prototype chain', () => {
		expect(() => evaluate('constructor', scope)).toThrow(FormulaError);
		expect(() => evaluate('power.constructor', scope)).toThrow(FormulaError);
		expect(() => evaluate('toString()', scope)).toThrow(/Unknown function/);
	});

	it('compiles once and evaluates against any scope', () => {
		const f = compile('power * 2');
		expect(f.source).toBe('power * 2');
		expect(f.evaluate({ power: 1 })).toBe(2);
		expect(f.evaluate({ power: 4 })).toBe(8);
	});
});

describe('renderTemplate', () => {
	it('fills every braced expression', () => {
		expect(renderTemplate('+{power}', scope)).toBe('+5');
		expect(renderTemplate('{signed(power - 7)} to hit, {cap(threat)}', scope)).toBe(
			'-2 to hit, Standard'
		);
		expect(renderTemplate('plain', scope)).toBe('plain');
		expect(renderTemplate('{power > 3 ? "big" : "small"}', scope)).toBe('big');
	});

	it('keeps doubled braces', () => {
		expect(renderTemplate('{{literal}} {power}', scope)).toBe('{literal} 5');
	});

	it('reports unclosed braces', () => {
		expect(() => renderTemplate('{power', scope)).toThrow(/Unclosed/);
	});
});
