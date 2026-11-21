// Rendering saved NPCs outside the generator: the adapter of the record's recipe, the preset's anchors, overrides.
import { PRESETS } from '../../content';
import { packs } from '../../data/packs.svelte';
import {
	applyOverrides,
	renderAdapter,
	renderGeneric,
	type Overrides,
	type StatBlock
} from '../../engine/adapter';
import type { NarrativeField, Npc, Recipe, SavedOverrides } from '../../engine/schema';
import { prefs } from '../../data/prefs.svelte';
import { textOptionsOf } from '../generate/display';
import type { TextOptions } from '../../engine/export';

export function adapterOf(recipe: Recipe): string {
	const preset = PRESETS.presets.find((p) => p.id === recipe.preset) ?? PRESETS.presets[0];
	return recipe.adapter === 'generic' || (recipe.adapter && packs.adapterById(recipe.adapter))
		? recipe.adapter
		: preset.adapter;
}

/** The stat block of a saved NPC, or null for a flavour NPC or when the adapter fails on it. */
export function blockOf(
	npc: Npc,
	recipe: Recipe,
	overrides: SavedOverrides = {}
): StatBlock | null {
	if (!npc.profile) return null;
	const preset = PRESETS.presets.find((p) => p.id === recipe.preset) ?? PRESETS.presets[0];
	const id = adapterOf(recipe);
	try {
		const pack = id === 'generic' ? undefined : packs.adapterById(id);
		const block = pack
			? renderAdapter(pack, npc, { anchors: preset.damageAnchors })
			: renderGeneric(npc, { anchors: preset.damageAnchors });
		return applyOverrides(block, (overrides[id] ?? {}) as Overrides);
	} catch {
		return null;
	}
}

/** Text callbacks for the exports: display labels, hidden fields left out. */
export function textOptions(npc: Npc, recipe: Recipe): TextOptions {
	return textOptionsOf(npc.narrative, (f: NarrativeField) => prefs.isHidden(f), recipe.preset);
}
