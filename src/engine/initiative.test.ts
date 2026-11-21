import { describe, expect, it } from 'vitest';
import { roll } from './dice';
import { rollInitiative } from './initiative';

describe('rollInitiative', () => {
	it('sorts highest first and keeps member order on ties', () => {
		const totals = [12, 18, 12];
		let i = 0;
		const fake = (expr: string) => ({ ...roll(expr), total: totals[i++], breakdown: 'x' });
		const out = rollInitiative(
			[{ name: 'A', dice: '1d20' }, { name: 'B', dice: '1d20+2' }, { name: 'C' }],
			fake
		);
		expect(out.map((e) => e.name)).toEqual(['B', 'A', 'C']);
		expect(out.map((e) => e.index)).toEqual([1, 0, 2]);
		expect(out[2].dice).toBe('1d20');
	});

	it('rolls real dice within range', () => {
		const out = rollInitiative([
			{ name: 'A', dice: '1d6' },
			{ name: 'B', dice: '1d6' }
		]);
		for (const e of out) {
			expect(e.total).toBeGreaterThanOrEqual(1);
			expect(e.total).toBeLessThanOrEqual(6);
		}
	});
});
