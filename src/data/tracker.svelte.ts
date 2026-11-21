// The tracker of the NPC on the generate screen. It follows the NPC: a new seed or tier resets it.
import type { TrackerHint } from '../engine/adapter';
import {
	damage,
	heal,
	newTracker,
	resetTracker,
	setHp,
	setHpMax,
	toggleCondition,
	type Tracker
} from '../engine/tracker';
import { rolls } from './rolls.svelte';

function createTrackerStore() {
	let key = $state<string | null>(null);
	let state = $state<Tracker>(newTracker());
	let hint = $state<TrackerHint>({ conditions: [] });

	return {
		get state() {
			return state;
		},
		get hint() {
			return hint;
		},
		/** Binds the tracker to an NPC. The same key keeps the current values; a new key starts over. */
		sync(nextKey: string, nextHint: TrackerHint) {
			hint = nextHint;
			if (nextKey === key) return;
			key = nextKey;
			state = newTracker(nextHint.hpMax ?? 0);
		},
		/** Puts saved values in place of the current ones; the binding key stays. */
		restore(saved: Tracker) {
			state = { hp: saved.hp, hpMax: saved.hpMax, conditions: [...saved.conditions] };
		},
		damage(n: number) {
			state = damage(state, n);
		},
		heal(n: number) {
			state = heal(state, n);
		},
		setHp(n: number) {
			state = setHp(state, n);
		},
		setHpMax(n: number) {
			state = setHpMax(state, n);
		},
		toggle(condition: string) {
			state = toggleCondition(state, condition);
		},
		reset() {
			state = resetTracker(state);
		},
		/** Rolls the adapter's hit dice and takes the result as the new maximum. */
		rollHp() {
			if (!hint.hpRoll) return;
			const entry = rolls.roll(hint.hpRoll, 'Hit points');
			state = { ...newTracker(entry.total), conditions: state.conditions };
		}
	};
}

export const tracker = createTrackerStore();
