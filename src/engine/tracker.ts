// Tracker rules: hit points and conditions for one NPC. Harm tracks use the same shape with a small maximum.

export interface Tracker {
	hp: number;
	hpMax: number;
	conditions: string[];
}

/** The condition list used when the adapter supplies none. */
export const GENERIC_CONDITIONS = [
	'bloodied',
	'prone',
	'grappled',
	'restrained',
	'frightened',
	'stunned',
	'poisoned',
	'blinded',
	'hidden',
	'unconscious'
] as const;

export const MAX_HP = 9999;

const clampHp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));

export function newTracker(hpMax = 0): Tracker {
	const max = clampHp(hpMax, MAX_HP);
	return { hp: max, hpMax: max, conditions: [] };
}

export function damage(t: Tracker, amount: number): Tracker {
	if (!Number.isFinite(amount) || amount <= 0) return t;
	return { ...t, hp: clampHp(t.hp - amount, t.hpMax) };
}

export function heal(t: Tracker, amount: number): Tracker {
	if (!Number.isFinite(amount) || amount <= 0) return t;
	return { ...t, hp: clampHp(t.hp + amount, t.hpMax) };
}

export function setHp(t: Tracker, hp: number): Tracker {
	if (!Number.isFinite(hp)) return t;
	return { ...t, hp: clampHp(hp, t.hpMax) };
}

/** Sets the maximum; current hit points follow when they were full or exceed the new maximum. */
export function setHpMax(t: Tracker, hpMax: number): Tracker {
	if (!Number.isFinite(hpMax)) return t;
	const max = clampHp(hpMax, MAX_HP);
	const wasFull = t.hp === t.hpMax;
	return { ...t, hpMax: max, hp: wasFull ? max : clampHp(t.hp, max) };
}

export function toggleCondition(t: Tracker, condition: string): Tracker {
	const has = t.conditions.includes(condition);
	return {
		...t,
		conditions: has ? t.conditions.filter((c) => c !== condition) : [...t.conditions, condition]
	};
}

export function resetTracker(t: Tracker): Tracker {
	return { ...t, hp: t.hpMax, conditions: [] };
}

/** At or below half the maximum, when there is one. */
export function isBloodied(t: Tracker): boolean {
	return t.hpMax > 0 && t.hp <= Math.floor(t.hpMax / 2);
}

export function isDown(t: Tracker): boolean {
	return t.hpMax > 0 && t.hp === 0;
}
