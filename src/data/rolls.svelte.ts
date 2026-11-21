// The roll log of this session: the newest first, at most ROLL_LOG_SIZE entries.
import { appendRoll, roll as rollDice, type RollLogEntry } from '../engine/dice';

function createRolls() {
	let entries = $state<RollLogEntry[]>([]);
	let nextId = 1;
	return {
		get entries() {
			return entries;
		},
		get last(): RollLogEntry | undefined {
			return entries[0];
		},
		/** Rolls an expression and logs it. Throws `DiceError` when it is not one. */
		roll(expression: string, label?: string): RollLogEntry {
			const entry: RollLogEntry = { ...rollDice(expression), id: nextId++, label, at: Date.now() };
			entries = appendRoll(entries, entry);
			return entry;
		},
		clear() {
			entries = [];
		}
	};
}

export const rolls = createRolls();
