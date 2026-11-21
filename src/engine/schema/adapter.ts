import { z } from 'zod';
import { COMPETENCIES } from './profile';
import { SLUG } from './tablePack';

export const FIELD_ID = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** One computed line of a stat block. `formula` and `roll` are expressions in the formula language. */
export const AdapterField = z.object({
	id: z.string().regex(FIELD_ID),
	label: z.string().optional(),
	/** Section the line is shown in. Default `header`. */
	section: z.string().regex(SLUG).optional(),
	formula: z.string().min(1),
	/** Expression whose result is a dice string; the line becomes a roll button. */
	roll: z.string().optional(),
	/** Template for the shown value; `{value}` is the formula's result. */
	format: z.string().optional(),
	/** Template for the note under the value. */
	note: z.string().optional(),
	/** Computed for later formulas but not shown. */
	hidden: z.boolean().optional(),
	/** Formula; the line is shown only when it is truthy. The value still joins the scope. */
	when: z.string().optional()
});
export type AdapterField = z.infer<typeof AdapterField>;

export const AdapterLookup = z.object({
	/** The keys in order; each walks one level of `rows`. */
	by: z.array(z.string()).min(1),
	/** The key value that selects the first element of an array row. Default 1. */
	base: z.number().int().optional(),
	rows: z.unknown()
});
export type AdapterLookup = z.infer<typeof AdapterLookup>;

export const AdapterSection = z.object({
	id: z.string().regex(SLUG),
	label: z.string().optional()
});
export type AdapterSection = z.infer<typeof AdapterSection>;

/** A data-driven system adapter: maps the abstract profile to a system's numbers. */
export const AdapterPack = z.object({
	format: z.literal('strangerloom-adapter'),
	schemaVersion: z.literal(1),
	id: z.string().regex(SLUG),
	name: z.string().min(1),
	version: z.number().int().nonnegative(),
	presets: z.array(z.string().regex(SLUG)).optional(),
	/** Labels by field id or section id. */
	labels: z.record(z.string(), z.string()).default({}),
	lookups: z.record(z.string(), AdapterLookup).default({}),
	fields: z.array(AdapterField).default([]),
	/** Templates per attack; the scope adds `attackName`, `kind`, `damageClass` and `attackTags`. */
	attack: z
		.object({
			/** Template for the whole line text. Default: composed from `toHit` and `damage`. */
			value: z.string().optional(),
			toHit: z.string().optional(),
			damage: z.string().optional(),
			note: z.string().optional(),
			/** Template for the roll string. Default: the damage when it is a dice expression. */
			roll: z.string().optional()
		})
		.default({}),
	/**
	 * Rating 0..5 to a system value. `scale[rating]` is the value (the rating itself when absent); `format` is a
	 * template over `value`, `rating`, `word`, `competency` and the NPC scope (so `power` can scale it); `skills`
	 * lists the system's skill names each competency stands for.
	 */
	competencies: z
		.object({
			scale: z.array(z.number()).length(6).optional(),
			label: z.string().optional(),
			format: z.string().optional(),
			skills: z.partialRecord(z.enum(COMPETENCIES), z.array(z.string())).optional()
		})
		.optional(),
	/** Named replacements for ability text, by ability id. */
	abilities: z
		.record(z.string(), z.object({ name: z.string().optional(), text: z.string().optional() }))
		.default({}),
	sections: z.array(z.union([z.string().regex(SLUG), AdapterSection])).min(1),
	subtitle: z.string().optional(),
	template: z.enum(['full', 'compact']).default('full'),
	tracker: z
		.object({
			/** Field id whose value is the maximum hit points. */
			hp: z.string().regex(FIELD_ID).optional(),
			/** Field id whose roll gives the hit points. */
			hpRoll: z.string().regex(FIELD_ID).optional(),
			conditions: z.array(z.string()).optional(),
			/** Formula for the initiative roll string. */
			initiative: z.string().optional()
		})
		.default({})
});
export type AdapterPack = z.infer<typeof AdapterPack>;
