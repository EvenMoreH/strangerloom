import { z } from 'zod';
import { Narrative } from './npc';

export const THREATS = ['minion', 'standard', 'elite', 'boss'] as const;
export type Threat = (typeof THREATS)[number];

export const ROLES = ['brute', 'skirmisher', 'controller', 'support', 'sniper', 'leader'] as const;
export type Role = (typeof ROLES)[number];

export const COMPETENCIES = [
	'combat',
	'magic',
	'stealth',
	'social',
	'knowledge',
	'survival'
] as const;
export type Competency = (typeof COMPETENCIES)[number];

export const DEFENCES = ['hard-to-hit', 'hard-to-kill', 'evasive'] as const;
export type Defence = (typeof DEFENCES)[number];

export const ABILITY_USES = ['passive', 'at-will', 'per-fight', 'reaction'] as const;
export type AbilityUse = (typeof ABILITY_USES)[number];

/** `area` covers spells and area-of-effect attacks; elites and bosses get them. */
export const ATTACK_KINDS = ['melee', 'ranged', 'area'] as const;
export type AttackKind = (typeof ATTACK_KINDS)[number];

export const DAMAGE_CLASSES = ['light', 'medium', 'heavy'] as const;
export type DamageClass = (typeof DAMAGE_CLASSES)[number];

export const COIN_LEVELS = ['none', 'few', 'modest', 'good', 'rich'] as const;
export type CoinLevel = (typeof COIN_LEVELS)[number];

const rating = z.number().int().min(0).max(5);

/** What a competency rating means to a GM, by rating. Adapters map the rating to their system's numbers. */
export const COMPETENCY_WORDS = [
	'untrained',
	'dabbler',
	'trained',
	'professional',
	'expert',
	'master'
] as const;

export const Competencies = z.object({
	combat: rating,
	magic: rating,
	stealth: rating,
	social: rating,
	knowledge: rating,
	survival: rating
});
export type Competencies = z.infer<typeof Competencies>;

export const Ability = z.object({
	id: z.string(),
	name: z.string(),
	text: z.string(),
	use: z.enum(ABILITY_USES)
});
export type Ability = z.infer<typeof Ability>;

/** `basic` is the always-available option; `signature` carries a rider and a trigger that says when to use it. */
export const ATTACK_USES = ['basic', 'signature'] as const;
export type AttackUse = (typeof ATTACK_USES)[number];

/** Physical damage is the default and is not named. */
export const DAMAGE_TYPES = [
	'fire',
	'cold',
	'shock',
	'poison',
	'acid',
	'radiant',
	'necrotic',
	'psychic'
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** `close` is arm's length, `near` a thrown stone, `far` a bowshot. */
export const RANGES = ['close', 'near', 'far'] as const;
export type Range = (typeof RANGES)[number];

/** Effect riders a signature attack may carry, with the one-line meaning shown to the GM. */
export const RIDERS = {
	'knock-down': 'Knocks the target to the ground.',
	push: 'Shoves the target away.',
	grab: 'Holds the target until it breaks free.',
	slow: 'The target moves at half pace for a while.',
	blind: 'The target cannot see for a moment.',
	frighten: 'The target hesitates to come closer.',
	daze: 'The target can move or act, not both.',
	bleed: 'The target keeps losing blood until treated.',
	ignite: 'The target burns until the fire is put out.',
	weaken: 'The target hits feebly for a while.',
	expose: 'The target is easier to hit for a moment.',
	silence: 'The target cannot speak or cast for a moment.',
	sleep: 'The target drops asleep until shaken awake.'
} as const;
export type Rider = keyof typeof RIDERS;
export const RIDER_IDS = Object.keys(RIDERS) as Rider[];

export const Attack = z.object({
	name: z.string(),
	kind: z.enum(ATTACK_KINDS),
	damage: z.enum(DAMAGE_CLASSES),
	use: z.enum(ATTACK_USES),
	range: z.enum(RANGES),
	damageType: z.enum(DAMAGE_TYPES).optional(),
	rider: z.enum(RIDER_IDS as [Rider, ...Rider[]]).optional(),
	/** When to reach for this option: "against a bloodied foe", "when foes bunch up". */
	trigger: z.string().optional(),
	/** What the damage compares to, as a noun phrase: "a fireball", "a sneak attack". Default: the setting's weapon. */
	anchor: z.string().optional()
});
export type Attack = z.infer<typeof Attack>;

/** Layer 2: the abstract capability profile. System adapters read this and nothing else. */
export const Profile = z.object({
	archetype: z.string(),
	archetypeLabel: z.string(),
	threat: z.enum(THREATS),
	power: z.number().int().min(1).max(10),
	role: z.enum(ROLES),
	competencies: Competencies,
	defence: z.enum(DEFENCES),
	tags: z.array(z.string()),
	abilities: z.array(Ability),
	attacks: z.array(Attack).min(1),
	gear: z.array(z.string()),
	loot: z.object({ coins: z.enum(COIN_LEVELS), items: z.array(z.string()) }),
	tactics: z.string()
});
export type Profile = z.infer<typeof Profile>;

/** The field paths of the profile layer that can be locked and rerolled. */
export const PROFILE_FIELDS = [
	'archetype',
	'competencies',
	'defence',
	'abilities',
	'attacks',
	'gear',
	'loot',
	'tactics'
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

/** Shape of an archetype entry's `meta` in the `archetype` table. */
export const ArchetypeMeta = z.object({
	label: z.string(),
	role: z.enum(ROLES),
	defence: z.enum(DEFENCES),
	tags: z.array(z.string()).default([]),
	competencies: Competencies,
	/** Occupations (narrative layer) that promote to this archetype. */
	occupations: z.array(z.string()).default([])
});
export type ArchetypeMeta = z.infer<typeof ArchetypeMeta>;

/** An NPC at any tier: the narrative layer always, the profile from Tier 2 on. */
export const Npc = z.object({
	tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	narrative: Narrative,
	profile: Profile.optional()
});
export type Npc = z.infer<typeof Npc>;
