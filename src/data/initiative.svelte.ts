// The initiative order of the party on the generate screen. It follows the party: a new seed clears it.
import { rollInitiative, type InitiativeEntry } from '../engine/initiative';

function createInitiative() {
	let key = $state<string | null>(null);
	let order = $state<InitiativeEntry[]>([]);
	return {
		get order() {
			return order;
		},
		/** Rolls for every member with the given dice and keeps the order under `nextKey`. */
		roll(nextKey: string, members: { name: string; dice?: string }[]) {
			key = nextKey;
			order = rollInitiative(members);
		},
		/** Drops the order when the party it belonged to is gone. */
		sync(nextKey: string) {
			if (key !== nextKey) {
				key = nextKey;
				order = [];
			}
		},
		clear() {
			order = [];
		}
	};
}

export const initiative = createInitiative();
