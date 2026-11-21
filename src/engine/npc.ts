// An NPC at any tier: narrative always, profile from Tier 2 on. Promotion keeps every existing field.
import {
	fieldText,
	generateNarrative,
	type Catalog,
	type Generated,
	type GenerateOptions
} from './narrative';
import { generateProfile } from './profile';
import { rerollField } from './recipe';
import {
	NARRATIVE_FIELDS,
	type NarrativeField,
	type Npc,
	type ProfileField,
	type Recipe
} from './schema';

export type NpcField = NarrativeField | ProfileField;

const narrativeSet: ReadonlySet<string> = new Set(NARRATIVE_FIELDS);

/** The recipe paths one card field rerolls and locks: the ancestry row carries the culture where there is one. */
export function pathsOf(npc: Npc, field: NpcField): string[] {
	if (field === 'ancestry' && npc.narrative.culture) return ['ancestry', 'culture'];
	return [field];
}

/** One string per card field, used to tell whether a reroll changed it. */
export function fieldValueText(npc: Npc, field: NpcField): string {
	if (field === 'ancestry' && npc.narrative.culture) {
		return `${npc.narrative.ancestry}, ${npc.narrative.culture}`;
	}
	if (narrativeSet.has(field)) return fieldText(npc.narrative, field as NarrativeField);
	if (!npc.profile) return '';
	return JSON.stringify(npc.profile[field as ProfileField]);
}

/** The value a lock stores for a card field. The archetype is locked through the option, not a lock. */
export function lockValueOf(npc: Npc, field: NpcField): unknown {
	if (narrativeSet.has(field)) {
		const f = field as NarrativeField;
		if (f === 'name') return npc.narrative.name;
		if (f === 'age') return npc.narrative.age;
		return npc.narrative[f];
	}
	if (!npc.profile || field === 'archetype') return undefined;
	return npc.profile[field as ProfileField];
}

/** How many draws a reroll tries before accepting a repeat (a fixed option or a one-entry table cannot change). */
export const REROLL_TRIES = 64;

export function generateNpc(
	recipe: Recipe,
	catalog: Catalog,
	opts: GenerateOptions = {}
): Generated<Npc> {
	const narrative = generateNarrative(recipe, catalog, opts);
	if (recipe.tier === 1) {
		return { value: { tier: 1, narrative: narrative.value }, recipe: narrative.recipe };
	}
	const profile = generateProfile(narrative.recipe, narrative.value, catalog);
	return {
		value: { tier: recipe.tier, narrative: narrative.value, profile },
		recipe: narrative.recipe
	};
}

/** The same recipe one tier up. Streams are keyed by field path, so existing fields keep their values. */
export function promote(recipe: Recipe): Recipe {
	if (recipe.tier >= 3) return recipe;
	return { ...recipe, tier: (recipe.tier + 1) as 2 | 3 };
}

export function demote(recipe: Recipe): Recipe {
	if (recipe.tier <= 1) return recipe;
	return { ...recipe, tier: (recipe.tier - 1) as 1 | 2 };
}

/**
 * Rerolls one card field until it differs from `current`, advancing its paths' nonces each try. Gives up after
 * `REROLL_TRIES` draws, when the field has only one possible value. Every other field keeps its value.
 */
export function rerollDistinct(
	recipe: Recipe,
	field: NpcField,
	current: Npc,
	catalog: Catalog,
	opts: GenerateOptions = {},
	tries = REROLL_TRIES
): Generated<Npc> {
	const before = fieldValueText(current, field);
	const paths = pathsOf(current, field);
	let next = recipe;
	let out: Generated<Npc> | undefined;
	for (let i = 0; i < tries; i++) {
		for (const path of paths) next = rerollField(next, path);
		out = generateNpc(next, catalog, opts);
		if (fieldValueText(out.value, field) !== before) return out;
	}
	return out!;
}
