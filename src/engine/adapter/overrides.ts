// Manual overrides: a GM's replacement text for a stat block line, keyed by line id, applied after rendering.
import type { StatBlock } from './types';

export type Overrides = Record<string, string>;

/** Replaces the value of every line named in `overrides`. An override of the hit point line moves the tracker's maximum. */
export function applyOverrides(block: StatBlock, overrides: Overrides): StatBlock {
	const ids = Object.keys(overrides);
	if (!ids.length) return block;
	const sections = block.sections.map((s) => ({
		...s,
		lines: s.lines.map((l) =>
			Object.hasOwn(overrides, l.id) ? { ...l, value: overrides[l.id], overridden: true } : l
		)
	}));
	const tracker = { ...block.tracker };
	if (tracker.hpLine && Object.hasOwn(overrides, tracker.hpLine)) {
		const n = Number.parseInt(overrides[tracker.hpLine], 10);
		if (Number.isFinite(n)) tracker.hpMax = Math.max(0, n);
	}
	return { ...block, sections, tracker };
}

/** Drops overrides whose line no longer exists in the block. */
export function pruneOverrides(block: StatBlock, overrides: Overrides): Overrides {
	const ids = new Set(block.sections.flatMap((s) => s.lines.map((l) => l.id)));
	return Object.fromEntries(Object.entries(overrides).filter(([id]) => ids.has(id)));
}
