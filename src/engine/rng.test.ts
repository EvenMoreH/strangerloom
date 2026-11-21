import { describe, expect, it } from 'vitest';
import {
	formatSeed,
	hash64,
	int,
	newSeed,
	normalizeSeed,
	pickWeighted,
	sfc32,
	stream
} from './rng';

describe('seeds', () => {
	it('newSeed gives 8 Crockford characters', () => {
		const seed = newSeed();
		expect(seed).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
		expect(normalizeSeed(seed)).toBe(seed);
	});

	it('newSeed uses the random bytes it is given', () => {
		expect(newSeed(() => {})).toBe('00000000');
		expect(
			newSeed((b) => {
				b.fill(31);
			})
		).toBe('ZZZZZZZZ');
	});

	it('normalizeSeed accepts separators, lower case and ambiguous letters', () => {
		expect(normalizeSeed('7kq2-m9xa')).toBe('7KQ2M9XA');
		expect(normalizeSeed('7KQ2 M9XA')).toBe('7KQ2M9XA');
		expect(normalizeSeed('OIL2M9XA')).toBe('0112M9XA');
		expect(normalizeSeed('7KQ2M9X')).toBeNull();
		expect(normalizeSeed('7KQ2M9XAA')).toBeNull();
		expect(normalizeSeed('7KQ2M9XU')).toBeNull();
	});

	it('formatSeed groups by four', () => {
		expect(formatSeed('7KQ2M9XA')).toBe('7KQ2-M9XA');
	});
});

describe('hash64 and sfc32', () => {
	it('hashes are stable and differ by input', () => {
		expect(hash64('abc')).toEqual(hash64('abc'));
		expect(hash64('abc')).not.toEqual(hash64('abd'));
		expect(hash64('abc', 1)).not.toEqual(hash64('abc', 2));
	});

	it('sfc32 yields floats in [0, 1) and is deterministic', () => {
		const a = sfc32(1, 2, 3, 4);
		const b = sfc32(1, 2, 3, 4);
		for (let i = 0; i < 1000; i++) {
			const x = a();
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThan(1);
			expect(b()).toBe(x);
		}
	});

	it('sfc32 output is spread across the unit interval', () => {
		const rng = sfc32(9, 8, 7, 6);
		const buckets = new Array(10).fill(0);
		for (let i = 0; i < 10_000; i++) buckets[Math.floor(rng() * 10)]++;
		for (const n of buckets) expect(n).toBeGreaterThan(800);
	});
});

describe('stream', () => {
	it('is reproducible and independent per path and nonce', () => {
		const take = (rng: () => number) => Array.from({ length: 5 }, rng);
		expect(take(stream('7KQ2M9XA', 'name'))).toEqual(take(stream('7KQ2M9XA', 'name')));
		expect(take(stream('7KQ2M9XA', 'name'))).not.toEqual(take(stream('7KQ2M9XA', 'quirk')));
		expect(take(stream('7KQ2M9XA', 'name', 0))).not.toEqual(take(stream('7KQ2M9XA', 'name', 1)));
		expect(take(stream('7KQ2M9XA', 'name'))).not.toEqual(take(stream('7KQ2M9XB', 'name')));
	});

	it('matches a stored sequence so results stay stable across versions', () => {
		const rng = stream('7KQ2M9XA', 'name', 0);
		const first = Array.from({ length: 3 }, () => Math.floor(rng() * 1_000_000));
		expect(first).toMatchInlineSnapshot(`
			[
			  644084,
			  65146,
			  276541,
			]
		`);
	});
});

describe('helpers', () => {
	it('int covers both bounds', () => {
		const rng = stream('AAAAAAAA', 'int');
		const seen = new Set<number>();
		for (let i = 0; i < 500; i++) seen.add(int(rng, 1, 6));
		expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
		expect(int(() => 0, 5, 3)).toBe(3);
	});

	it('pickWeighted follows the weights', () => {
		const rng = stream('AAAAAAAA', 'weighted');
		const counts = { a: 0, b: 0 };
		for (let i = 0; i < 3000; i++)
			counts[pickWeighted(rng, ['a', 'b'] as const, (x) => (x === 'a' ? 3 : 1))]++;
		expect(counts.a / counts.b).toBeGreaterThan(2.4);
		expect(counts.a / counts.b).toBeLessThan(3.6);
	});
});
