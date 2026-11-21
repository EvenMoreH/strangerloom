import { z } from 'zod';
import { GENDERS } from './preset';

export const NpcName = z.object({
	given: z.string(),
	family: z.string(),
	extra: z.string(),
	extraLabel: z.string(),
	full: z.string()
});
export type NpcName = z.infer<typeof NpcName>;

export const NpcAge = z.object({ stage: z.string(), years: z.number().int().nonnegative() });
export type NpcAge = z.infer<typeof NpcAge>;

export const ATTITUDES = ['friendly', 'wary', 'hostile'] as const;

/** Layer 1: the narrative fields. Identical across game systems. */
export const Narrative = z.object({
	ancestry: z.string(),
	gender: z.enum(GENDERS),
	pronouns: z.string(),
	culture: z.string().optional(),
	name: NpcName,
	age: NpcAge,
	occupation: z.string(),
	quirk: z.string(),
	visual: z.string(),
	trait: z.string(),
	ideal: z.string(),
	bond: z.string(),
	flaw: z.string(),
	voice: z.string(),
	mood: z.string(),
	attitude: z.string(),
	secret: z.string()
});
export type Narrative = z.infer<typeof Narrative>;

/** The field paths of the narrative layer, in generation order. */
export const NARRATIVE_FIELDS = [
	'ancestry',
	'gender',
	'culture',
	'name',
	'pronouns',
	'age',
	'occupation',
	'quirk',
	'visual',
	'trait',
	'ideal',
	'bond',
	'flaw',
	'voice',
	'mood',
	'attitude',
	'secret'
] as const;
export type NarrativeField = (typeof NARRATIVE_FIELDS)[number];
