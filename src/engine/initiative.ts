// Initiative: one roll per party member with the adapter's dice, sorted highest first.
import { roll, type RollResult } from './dice';

export interface InitiativeEntry {
	/** Member index. */
	index: number;
	name: string;
	dice: string;
	total: number;
	breakdown: string;
}

/** The dice used when the adapter names none. */
export const DEFAULT_INITIATIVE = '1d20';

export function rollInitiative(
	members: { name: string; dice?: string }[],
	rollDice: (expression: string) => RollResult = roll
): InitiativeEntry[] {
	const entries = members.map((m, index) => {
		const dice = m.dice ?? DEFAULT_INITIATIVE;
		const r = rollDice(dice);
		return { index, name: m.name, dice, total: r.total, breakdown: r.breakdown };
	});
	// Highest first; ties keep member order.
	return entries.sort((a, b) => b.total - a.total || a.index - b.index);
}
