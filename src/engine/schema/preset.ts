import { z } from 'zod';
import { SLUG } from './tablePack';

/** Damage classes anchored to things every GM of the setting knows: "medium damage, like a sword". */
export const DamageAnchors = z.object({ light: z.string(), medium: z.string(), heavy: z.string() });
export type DamageAnchors = z.infer<typeof DamageAnchors>;
export const FANTASY_ANCHORS: DamageAnchors = {
	light: 'a dagger',
	medium: 'a sword',
	heavy: 'a greataxe'
};

export const GENDERS = ['f', 'm', 'n'] as const;
export type Gender = (typeof GENDERS)[number];

export const AncestryDef = z.object({
	label: z.string().min(1),
	/** Multiplier applied to the human years of an age stage. */
	ageScale: z.number().positive().default(1)
});
export type AncestryDef = z.infer<typeof AncestryDef>;

export const CultureDef = z.object({ label: z.string().min(1) });

export const Preset = z.object({
	id: z.string().regex(SLUG),
	name: z.string().min(1),
	description: z.string().default(''),
	/** Packs enabled by this preset, in merge order. */
	packs: z.array(z.string().regex(SLUG)).min(1),
	/** Ancestries offered, with pick weights. */
	ancestries: z
		.array(z.object({ id: z.string().regex(SLUG), w: z.number().positive().default(1) }))
		.min(1),
	/** Cultures offered for name generation; empty when the preset has no culture choice. */
	cultures: z.array(z.string().regex(SLUG)).default([]),
	/** How the culture follows the ancestry on the card and in the blurb, with `{culture}` for its label: for
	 *  example "of {culture} heritage" gives "Dwarf of Chinese heritage". Absent: "Dwarf, Chinese". */
	cultureFrame: z.string().optional(),
	/** Tone tags active by default. Entries conditioned on `tone` need one of them. */
	tone: z.array(z.string()).min(1),
	adapter: z.string().regex(SLUG).default('generic'),
	/** What light, medium and heavy damage compare to in this setting. */
	damageAnchors: DamageAnchors.default(FANTASY_ANCHORS)
});
export type Preset = z.infer<typeof Preset>;

export const PresetFile = z.object({
	format: z.literal('strangerloom-presets'),
	schemaVersion: z.literal(1),
	ancestries: z.record(z.string().regex(SLUG), AncestryDef),
	cultures: z.record(z.string().regex(SLUG), CultureDef),
	presets: z.array(Preset).min(1)
});
export type PresetFile = z.infer<typeof PresetFile>;
