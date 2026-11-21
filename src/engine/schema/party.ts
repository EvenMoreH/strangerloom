import { z } from 'zod';
import { Npc } from './profile';

/** Tier 3: an adventuring party of Tier 2 members. */
export const RELATIONSHIP_KINDS = [
	'rivalry',
	'romance',
	'debt',
	'kinship',
	'mentorship',
	'grudge',
	'oath',
	'friendship',
	'secret'
] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export const Relationship = z.object({
	/** Member indices. */
	a: z.number().int().nonnegative(),
	b: z.number().int().nonnegative(),
	kind: z.enum(RELATIONSHIP_KINDS),
	text: z.string()
});
export type Relationship = z.infer<typeof Relationship>;

export const PARTY_MIN = 3;
export const PARTY_MAX = 6;

export const Party = z.object({
	name: z.string(),
	reputation: z.string(),
	goal: z.string(),
	leaderIndex: z.number().int().nonnegative(),
	members: z.array(Npc).min(PARTY_MIN).max(PARTY_MAX),
	relationships: z.array(Relationship),
	tactics: z.string(),
	loot: z.object({ pool: z.string(), notable: z.string() }),
	hook: z.string()
});
export type Party = z.infer<typeof Party>;

/** The party-level fields a GM can lock and reroll. Recipe paths are `party.<field>`. */
export const PARTY_FIELDS = [
	'name',
	'reputation',
	'goal',
	'leader',
	'relationships',
	'tactics',
	'loot',
	'hook'
] as const;
export type PartyField = (typeof PARTY_FIELDS)[number];
