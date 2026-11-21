import { describe, expect, it } from 'vitest';
import {
	damage,
	heal,
	isBloodied,
	isDown,
	newTracker,
	resetTracker,
	setHp,
	setHpMax,
	toggleCondition
} from './tracker';

describe('tracker', () => {
	it('starts full', () => {
		expect(newTracker(20)).toEqual({ hp: 20, hpMax: 20, conditions: [] });
		expect(newTracker()).toEqual({ hp: 0, hpMax: 0, conditions: [] });
		expect(newTracker(-5).hpMax).toBe(0);
		expect(newTracker(12.6).hpMax).toBe(13);
	});

	it('clamps damage and healing', () => {
		const t = newTracker(10);
		expect(damage(t, 4).hp).toBe(6);
		expect(damage(t, 40).hp).toBe(0);
		expect(damage(t, -3).hp).toBe(10);
		expect(damage(t, NaN).hp).toBe(10);
		expect(heal(damage(t, 4), 2).hp).toBe(8);
		expect(heal(t, 5).hp).toBe(10);
		expect(setHp(t, 3).hp).toBe(3);
		expect(setHp(t, 99).hp).toBe(10);
		expect(setHp(t, -1).hp).toBe(0);
	});

	it('moves current with the maximum when full, otherwise clamps', () => {
		const t = newTracker(10);
		expect(setHpMax(t, 15)).toMatchObject({ hp: 15, hpMax: 15 });
		const hurt = damage(t, 5);
		expect(setHpMax(hurt, 15)).toMatchObject({ hp: 5, hpMax: 15 });
		expect(setHpMax(hurt, 3)).toMatchObject({ hp: 3, hpMax: 3 });
		expect(setHpMax(t, 99999).hpMax).toBe(9999);
	});

	it('toggles conditions and resets', () => {
		let t = toggleCondition(newTracker(10), 'prone');
		expect(t.conditions).toEqual(['prone']);
		t = toggleCondition(t, 'stunned');
		expect(t.conditions).toEqual(['prone', 'stunned']);
		t = toggleCondition(t, 'prone');
		expect(t.conditions).toEqual(['stunned']);
		expect(resetTracker(damage(t, 7))).toEqual({ hp: 10, hpMax: 10, conditions: [] });
	});

	it('knows bloodied and down', () => {
		const t = newTracker(11);
		expect(isBloodied(t)).toBe(false);
		expect(isBloodied(damage(t, 6))).toBe(true);
		expect(isBloodied(damage(t, 5))).toBe(false);
		expect(isDown(damage(t, 11))).toBe(true);
		expect(isDown(damage(t, 10))).toBe(false);
		expect(isBloodied(newTracker(0))).toBe(false);
		expect(isDown(newTracker(0))).toBe(false);
	});
});
