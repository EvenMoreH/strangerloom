// What every adapter produces: sections of labelled lines. A line with `roll` is a dice expression the UI can roll.

export interface StatLine {
	id: string;
	label?: string;
	value: string;
	roll?: string;
	/** Smaller text under the value: an ability's description, an attack's rider and trigger. */
	note?: string;
	/** Lines that share a group are shown under a small heading: "At will", "Signature". */
	group?: string;
	/** The value was replaced by a manual override. */
	overridden?: boolean;
	/** The parts of an attack line, for exports that need them apart: kind and range always, dice when the adapter has them. */
	attack?: { kind: string; range: string; toHit?: string; damage?: string; damageType?: string };
}

export interface StatSection {
	id: string;
	label: string;
	/** One line of context under the heading: the damage legend of the Attacks section. */
	note?: string;
	lines: StatLine[];
}

/** What the tracker starts from: maximum hit points when the adapter has them, and the condition list. */
export interface TrackerHint {
	hpMax?: number;
	/** Dice string that rolls the hit points. */
	hpRoll?: string;
	/** Id of the line whose value is the maximum hit points; an override of that line moves `hpMax`. */
	hpLine?: string;
	conditions: string[];
	/** Dice string for initiative, when the adapter defines one. */
	initiative?: string;
}

export interface StatBlock {
	adapter: string;
	adapterVersion: number;
	title: string;
	subtitle: string;
	sections: StatSection[];
	tracker: TrackerHint;
}
