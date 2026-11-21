import { z } from 'zod';

export const SLUG = /^[a-z0-9-]+$/;
export const TABLE_ID = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

/** Keys a `when` condition may test. Each maps to a value of the generation context. */
export const CONDITION_KEYS = [
	'preset',
	'ancestry',
	'gender',
	'archetype',
	'role',
	'tone',
	'tier',
	'age'
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

export const Condition = z.partialRecord(z.enum(CONDITION_KEYS), z.array(z.string()).min(1));
export type Condition = z.infer<typeof Condition>;

export const EntryObject = z.object({
	v: z.string(),
	w: z.number().positive().optional(),
	tags: z.array(z.string()).optional(),
	when: Condition.optional(),
	meta: z.record(z.string(), z.unknown()).optional()
});
export type EntryObject = z.infer<typeof EntryObject>;

export const Entry = z.union([z.string(), EntryObject]);
export type Entry = z.infer<typeof Entry>;

/** The grammatical shape of a table's entries, which tells the blurb how to join them into a sentence. */
export const SHAPES = ['verb', 'noun', 'adjective', 'sentence'] as const;
export const Shape = z.enum(SHAPES);
export type Shape = z.infer<typeof Shape>;

export const Table = z.object({
	entries: z.array(Entry).min(1),
	/** How the entries read: `verb` phrases after a name ("has a limp"), `noun` phrases ("a pipe that is never
	 *  lit"), bare `adjective`s ("wary") or whole `sentence`s. The blurb picks its connectives from it. */
	shape: Shape.optional(),
	/** A user pack's table that stands in for the merged table of the same id instead of adding to it. */
	replace: z.boolean().optional(),
	phonetic: z.boolean().optional(),
	min: z.number().int().positive().optional(),
	max: z.number().int().positive().optional()
});
export type Table = z.infer<typeof Table>;

export const TablePack = z.object({
	format: z.literal('strangerloom-tables'),
	schemaVersion: z.literal(1),
	id: z.string().regex(SLUG),
	name: z.string().min(1),
	version: z.number().int().nonnegative(),
	presets: z.array(z.string().regex(SLUG)).optional(),
	/** Attribution lines for material the pack draws on. */
	credits: z.array(z.string()).optional(),
	tables: z.record(z.string().regex(TABLE_ID), Table)
});
export type TablePack = z.infer<typeof TablePack>;
