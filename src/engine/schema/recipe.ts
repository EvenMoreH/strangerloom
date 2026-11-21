import { z } from 'zod';
import { SLUG } from './tablePack';
import { GENDERS } from './preset';

export const SEED = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export const RecipeOptions = z.object({
	ancestry: z.string().default('any'),
	gender: z.enum([...GENDERS, 'any']).default('any'),
	culture: z.string().default('any'),
	archetype: z.string().default('any'),
	power: z.number().int().min(1).max(10).default(5),
	threat: z.enum(['auto', 'minion', 'standard', 'elite', 'boss']).default('auto'),
	partySize: z.number().int().min(3).max(6).default(4)
});
export type RecipeOptions = z.infer<typeof RecipeOptions>;

export const RecipeFilters = z.object({
	ancestries: z.array(z.string()).default([]),
	archetypes: z.array(z.string()).default([]),
	tone: z.array(z.string()).default([])
});
export type RecipeFilters = z.infer<typeof RecipeFilters>;

export const Recipe = z.object({
	v: z.literal(1),
	seed: z.string().regex(SEED),
	tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	preset: z.string().regex(SLUG),
	options: RecipeOptions.prefault({}),
	filters: RecipeFilters.prefault({}),
	nonces: z.record(z.string(), z.number().int().nonnegative()).default({}),
	locks: z.record(z.string(), z.unknown()).default({}),
	packs: z.record(z.string().regex(SLUG), z.number().int().nonnegative()).default({}),
	adapter: z.string().regex(SLUG).optional()
});
export type Recipe = z.infer<typeof Recipe>;
