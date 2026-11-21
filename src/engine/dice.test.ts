import { describe, expect, it } from 'vitest';
import {
	appendRoll,
	DiceError,
	isDice,
	normalizeDice,
	parseDice,
	roll,
	type RollLogEntry
} from './dice';
import { stream } from './rng';

/** An rng that returns fixed die faces in order (1-based faces for the given sides). */
const faces = (values: number[], sides: number) => {
	let i = 0;
	return () => (values[i++ % values.length] - 1) / sides;
};

describe('parseDice', () => {
	it('parses plain dice and modifiers', () => {
		expect(parseDice('d20').terms).toEqual([
			{ kind: 'dice', sign: 1, count: 1, sides: 20, explode: false }
		]);
		expect(parseDice('2d6 + 3').terms).toEqual([
			{ kind: 'dice', sign: 1, count: 2, sides: 6, explode: false },
			{ kind: 'const', sign: 1, value: 3 }
		]);
		expect(parseDice('1d8-1d4-2').terms.map((t) => t.sign)).toEqual([1, -1, -1]);
		expect(parseDice('-2').terms).toEqual([{ kind: 'const', sign: -1, value: 2 }]);
	});

	it('parses keep, drop and explode', () => {
		expect(parseDice('4d6kh3').terms[0]).toMatchObject({ keep: { mode: 'kh', n: 3 } });
		expect(parseDice('4d6k3').terms[0]).toMatchObject({ keep: { mode: 'kh', n: 3 } });
		expect(parseDice('2d20kl1').terms[0]).toMatchObject({ keep: { mode: 'kl', n: 1 } });
		expect(parseDice('4d6dl1').terms[0]).toMatchObject({ keep: { mode: 'dl', n: 1 } });
		expect(parseDice('4d6dh1').terms[0]).toMatchObject({ keep: { mode: 'dh', n: 1 } });
		expect(parseDice('3d6!').terms[0]).toMatchObject({ explode: true });
		expect(parseDice('3d6!kh2').terms[0]).toMatchObject({
			explode: true,
			keep: { mode: 'kh', n: 2 }
		});
	});

	it('reads percentile dice and is case-insensitive', () => {
		expect(parseDice('d%').terms[0]).toMatchObject({ sides: 100 });
		expect(parseDice('2D10').text).toBe('2d10');
		expect(parseDice(' 1d6 +2 ').text).toBe('1d6+2');
	});

	it('rejects what is not a dice expression', () => {
		for (const bad of [
			'',
			'abc',
			'1d',
			'd0',
			'0d6',
			'101d6',
			'1d1001',
			'1d6+',
			'2d6k3',
			'1d6kh1kl1',
			'1d1!',
			'1d6 1d6',
			'1d6*2'
		]) {
			expect(() => parseDice(bad), bad).toThrow(DiceError);
		}
		expect(isDice('1d6')).toBe(true);
		expect(isDice('Medium')).toBe(false);
	});

	it('normalizes spelling and leaves other strings alone', () => {
		expect(normalizeDice('D% + 5')).toBe('1d100+5');
		expect(normalizeDice('+1d6')).toBe('1d6');
		expect(normalizeDice('hello')).toBe('hello');
	});
});

describe('roll', () => {
	it('sums dice and constants', () => {
		const r = roll('2d6+3', faces([4, 2], 6));
		expect(r.total).toBe(9);
		expect(r.terms[0]).toMatchObject({ rolls: [4, 2], kept: [true, true], subtotal: 6 });
		expect(r.breakdown).toBe('[4, 2] + 3 = 9');
		expect(r.expression).toBe('2d6+3');
	});

	it('subtracts negative terms', () => {
		const r = roll('1d8-1d4-1', faces([7, 3], 8));
		expect(r.terms[1]).toMatchObject({ rolls: [Math.floor(((3 - 1) / 8) * 4) + 1] });
		expect(r.total).toBe(7 - r.terms[1].subtotal * -1 - 1);
		expect(r.breakdown).toMatch(/^\[7\] - \[\d\] - 1 = /);
	});

	it('keeps and drops the right dice', () => {
		expect(roll('4d6kh3', faces([1, 5, 3, 6], 6))).toMatchObject({
			total: 14,
			breakdown: '[(1), 5, 3, 6] = 14'
		});
		expect(roll('4d6kl1', faces([1, 5, 3, 6], 6)).total).toBe(1);
		expect(roll('4d6dl1', faces([1, 5, 3, 6], 6)).total).toBe(14);
		expect(roll('4d6dh2', faces([1, 5, 3, 6], 6)).total).toBe(4);
		// Ties drop the earlier die first.
		expect(roll('3d6kh1', faces([6, 6, 2], 6)).terms[0]).toMatchObject({
			kept: [false, true, false]
		});
	});

	it('explodes on the maximum face', () => {
		const r = roll('1d6!', faces([6, 6, 2], 6));
		expect(r.terms[0]).toMatchObject({ rolls: [6, 6, 2], subtotal: 14 });
		expect(r.total).toBe(14);
	});

	it('caps runaway explosions', () => {
		const r = roll('1d6!', () => 0.999);
		expect((r.terms[0] as { rolls: number[] }).rolls.length).toBe(101);
	});

	it('is deterministic with a seeded stream', () => {
		const a = roll('3d6+1d20', stream('7KQ2M9XA', 'dice', 0));
		const b = roll('3d6+1d20', stream('7KQ2M9XA', 'dice', 0));
		expect(a).toEqual(b);
		for (const t of a.terms) {
			if (t.kind === 'dice') for (const v of t.rolls) expect(v >= 1 && v <= t.sides).toBe(true);
		}
	});

	it('accepts a parsed expression', () => {
		expect(roll(parseDice('1d4'), () => 0).total).toBe(1);
		expect(roll('d%', () => 0.5).total).toBe(51);
	});
});

describe('appendRoll', () => {
	it('keeps the newest first and at most the size', () => {
		const entry = (id: number): RollLogEntry => ({
			...roll('1d6', () => 0),
			id,
			at: id
		});
		let log: RollLogEntry[] = [];
		for (let i = 1; i <= 55; i++) log = appendRoll(log, entry(i));
		expect(log.length).toBe(50);
		expect(log[0].id).toBe(55);
		expect(log[49].id).toBe(6);
		expect(appendRoll([], entry(1), 3).length).toBe(1);
	});
});
