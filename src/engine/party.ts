// Tier 3: an adventuring party. Every member is a Tier 2 NPC with its own derived seed; party-level fields draw
// from their own streams under `party.<field>`. Recipe paths: `party.<field>`, `m<i>` (whole member), `m<i>.<field>`.
import { generateNpc, fieldValueText, lockValueOf, pathsOf, type NpcField } from './npc';
import type { NarrativeField } from './schema';
import { presetOf, type Catalog, type Generated } from './narrative';
import { isLocked, lockField, rerollField, unlockField } from './recipe';
import { chance, int, pickWeighted, stream, SEED_ALPHABET, SEED_LENGTH, type Rng } from './rng';
import {
	ArchetypeMeta,
	NARRATIVE_FIELDS,
	Npc,
	PARTY_MAX,
	PARTY_MIN,
	PROFILE_FIELDS,
	RELATIONSHIP_KINDS,
	type EntryObject,
	type Party,
	type PartyField,
	type Recipe,
	type Relationship,
	type RelationshipKind,
	type Role
} from './schema';
import { weightOf, type GenContext } from './tables';
import { Expander } from './template';

export const memberKey = (i: number) => `m${i}`;
export const memberPath = (i: number, field: string) => `m${i}.${field}`;
export const partyPath = (field: PartyField) => `party.${field}`;

/** What a reroll or lock on the party screen points at. */
export type PartyTarget = { field: PartyField } | { member: number; field?: NpcField };

/** The recipe paths a target rerolls and locks. */
export function partyPaths(party: Party, target: PartyTarget): string[] {
	if ('member' in target) {
		if (target.field === undefined) return [memberKey(target.member)];
		return pathsOf(party.members[target.member], target.field).map((p) =>
			memberPath(target.member, p)
		);
	}
	return [partyPath(target.field)];
}

/** A member's own seed: derived from the party seed, the slot and the slot's reroll counter. */
export function memberSeed(seed: string, i: number, nonce = 0): string {
	const rng = stream(seed, memberKey(i), nonce);
	let out = '';
	for (let k = 0; k < SEED_LENGTH; k++) out += SEED_ALPHABET[int(rng, 0, SEED_ALPHABET.length - 1)];
	return out;
}

interface Slot {
	power: number;
	archetype: string;
}

/** The Tier 2 recipe of one member: scoped nonces and locks, the slot's power and archetype. */
export function memberRecipe(recipe: Recipe, i: number, slot: Slot): Recipe {
	const prefix = `${memberKey(i)}.`;
	const scoped = <T>(record: Record<string, T>): Record<string, T> =>
		Object.fromEntries(
			Object.entries(record)
				.filter(([k]) => k.startsWith(prefix))
				.map(([k, v]) => [k.slice(prefix.length), v])
		);
	const locks = scoped(recipe.locks);
	// The archetype and power locks are the member's options, as the archetype lock is on the single-NPC card.
	const archetype = typeof locks.archetype === 'string' ? locks.archetype : slot.archetype;
	const power = typeof locks.power === 'number' ? locks.power : slot.power;
	delete locks.archetype;
	delete locks.power;
	return {
		v: 1,
		seed: memberSeed(recipe.seed, i, recipe.nonces[memberKey(i)] ?? 0),
		tier: 2,
		preset: recipe.preset,
		options: { ...recipe.options, power, archetype },
		filters: recipe.filters,
		nonces: scoped(recipe.nonces),
		locks,
		packs: recipe.packs,
		...(recipe.adapter ? { adapter: recipe.adapter } : {})
	};
}

const BALANCED_ROLES: Role[][] = [
	['brute'],
	['support'],
	['skirmisher', 'sniper'],
	['controller', 'leader']
];
const POWER_SPREAD = [-1, 0, 0, 1];

class PartyDrawer {
	constructor(public recipe: Recipe) {}
	field<T>(field: PartyField, draw: (rng: Rng) => T): T {
		const path = partyPath(field);
		if (isLocked(this.recipe, path)) return this.recipe.locks[path] as T;
		return draw(stream(this.recipe.seed, path, this.recipe.nonces[path] ?? 0));
	}
}

interface RawRelationship {
	a: number;
	b: number;
	kind: RelationshipKind;
	/** With `[a]` and `[b]` placeholders. */
	template: string;
}

const BAND = (power: number) => (power <= 3 ? 'low' : power <= 7 ? 'mid' : 'high');

export interface PartyGenerateOptions {
	/** Session duplicate avoidance, asked per member so a reroll of one member leaves the others as they are. */
	avoid?: (field: NarrativeField, value: string, member: number) => boolean;
}

/** Generates a party: members first (their own seeds), then the party-level fields. */
export function generateParty(
	recipe: Recipe,
	catalog: Catalog,
	opts: PartyGenerateOptions = {}
): Generated<Party> {
	const preset = presetOf(catalog, recipe.preset);
	const tables = catalog.tables;
	const size = Math.min(PARTY_MAX, Math.max(PARTY_MIN, recipe.options.partySize));
	const avg = recipe.options.power;
	const ctx: GenContext = {
		preset: preset.id,
		tier: 3,
		tone: recipe.filters.tone.length ? recipe.filters.tone : preset.tone
	};
	let out = recipe;

	// Slots: roles and powers, from one stream so size and balance changes reshuffle predictably.
	const archetypes = tables.entries('archetype', { preset: preset.id }).map((e) => ({
		entry: e,
		role: ArchetypeMeta.parse(e.meta ?? {}).role
	}));
	const slotRng = stream(recipe.seed, 'party.slots', recipe.nonces['party.slots'] ?? 0);
	const slots: Slot[] = [];
	for (let i = 0; i < size; i++) {
		const power = Math.min(10, Math.max(1, avg + POWER_SPREAD[int(slotRng, 0, 3)]));
		let archetype = 'any';
		if (i < BALANCED_ROLES.length) {
			const wanted = BALANCED_ROLES[i];
			const pool = archetypes.filter((a) => wanted.includes(a.role));
			if (pool.length) archetype = pickWeighted(slotRng, pool, (a) => weightOf(a.entry)).entry.v;
		}
		slots.push({ power, archetype });
	}

	// Members: a locked slot holds the whole NPC; otherwise the member generates from its own recipe.
	const members: Npc[] = slots.map((slot, i) => {
		const lock = recipe.locks[memberKey(i)];
		if (lock !== undefined) {
			const parsed = Npc.safeParse(lock);
			if (parsed.success && parsed.data.profile) return parsed.data;
		}
		const sub = memberRecipe(out, i, slot);
		const avoid = opts.avoid;
		const made = generateNpc(sub, catalog, avoid ? { avoid: (f, v) => avoid(f, v, i) } : {});
		// Duplicate avoidance may have advanced member nonces: fold them back under the member prefix.
		for (const [k, v] of Object.entries(made.recipe.nonces)) {
			if (sub.nonces[k] !== v) out = { ...out, nonces: { ...out.nonces, [memberPath(i, k)]: v } };
		}
		return made.value;
	});

	const drawer = new PartyDrawer(out);
	const expand = (rng: Rng) => new Expander(tables, ctx, rng);
	const line = (field: PartyField, table: string) =>
		drawer.field(field, (rng) => expand(rng).fromTable(table).value);

	const name = line('name', 'party.name');
	const reputation = line('reputation', 'party.reputation');
	const goal = line('goal', 'party.goal');
	const tactics = line('tactics', 'party.tactics');
	const hook = line('hook', 'party.hook');

	const leaderIndex = Math.min(
		size - 1,
		drawer.field('leader', (rng) => {
			// The first draw follows the rule (a leader by role, else the strongest); a reroll hands the lead to any member.
			if ((out.nonces[partyPath('leader')] ?? 0) > 0) return int(rng, 0, size - 1);
			const leaders = members.flatMap((m, i) => (m.profile?.role === 'leader' ? [i] : []));
			if (leaders.length) return leaders[int(rng, 0, leaders.length - 1)];
			const top = Math.max(...members.map((m) => m.profile?.power ?? 0));
			const strongest = members.flatMap((m, i) => (m.profile?.power === top ? [i] : []));
			return strongest[int(rng, 0, strongest.length - 1)];
		})
	);

	const loot = drawer.field('loot', (rng) => {
		const ex = expand(rng);
		const band = BAND(avg);
		const pools = tables
			.entries('party.loot.pool', ctx)
			.filter((e) => ((e.meta as { band?: string } | undefined)?.band ?? band) === band);
		return {
			pool: ex.part(pools, 'party.loot.pool').value,
			notable: ex.fromTable('party.loot.notable').value
		};
	});

	const raw = drawer.field('relationships', (rng) =>
		drawRelationships(rng, size, tables.entries('party.relationship', ctx))
	);
	const given = (i: number) => members[i]?.narrative.name.given ?? `member ${i + 1}`;
	const relationships: Relationship[] = raw
		.filter((r) => r.a < size && r.b < size)
		.map((r) => ({
			a: r.a,
			b: r.b,
			kind: r.kind,
			text: r.template.replace(/\[a\]/g, given(r.a)).replace(/\[b\]/g, given(r.b))
		}));

	return {
		value: { name, reputation, goal, leaderIndex, members, relationships, tactics, loot, hook },
		recipe: out
	};
}

/** A chain through every member in a shuffled order, plus one extra pair in half the parties. */
function drawRelationships(rng: Rng, size: number, entries: EntryObject[]): RawRelationship[] {
	const order = [...Array(size).keys()];
	for (let i = order.length - 1; i > 0; i--) {
		const j = int(rng, 0, i);
		[order[i], order[j]] = [order[j], order[i]];
	}
	const pairs: [number, number][] = [];
	for (let i = 0; i + 1 < order.length; i++) pairs.push([order[i], order[i + 1]]);
	if (chance(rng, 0.5)) {
		const a = order[0];
		const b = order[order.length - 1];
		if (!pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) pairs.push([a, b]);
	}
	const used = new Set<string>();
	return pairs.map(([a, b]) => {
		const fresh = entries.filter((e) => !used.has(e.v));
		const entry = pickWeighted(rng, fresh.length ? fresh : entries, weightOf);
		used.add(entry.v);
		const kind = (entry.meta as { kind?: string } | undefined)?.kind;
		return {
			a,
			b,
			kind: (RELATIONSHIP_KINDS as readonly string[]).includes(kind ?? '')
				? (kind as RelationshipKind)
				: 'friendship',
			template: entry.v
		};
	});
}

/** One string per target, used to tell whether a reroll changed it. */
export function partyValueText(party: Party, target: PartyTarget): string {
	if ('member' in target) {
		const m = party.members[target.member];
		if (!m) return '';
		return target.field === undefined ? JSON.stringify(m) : fieldValueText(m, target.field);
	}
	switch (target.field) {
		case 'leader':
			return String(party.leaderIndex);
		case 'loot':
			return JSON.stringify(party.loot);
		case 'relationships':
			return JSON.stringify(party.relationships);
		default:
			return party[target.field];
	}
}

/** The value a lock stores for a target. */
export function partyLockValue(party: Party, target: PartyTarget, recipe: Recipe): unknown {
	if ('member' in target) {
		const m = party.members[target.member];
		if (target.field === undefined) return m;
		if (target.field === 'archetype') return m.profile?.archetype;
		return lockValueOf(m, target.field);
	}
	switch (target.field) {
		case 'leader':
			return party.leaderIndex;
		case 'loot':
			return party.loot;
		case 'relationships':
			// The lock keeps the raw form so names follow the members: regenerate it from the current stream.
			return recipe.locks[partyPath('relationships')] ?? rawRelationshipsOf(party);
		default:
			return party[target.field];
	}
}

function rawRelationshipsOf(party: Party): RawRelationship[] {
	return party.relationships.map((r) => ({
		a: r.a,
		b: r.b,
		kind: r.kind,
		template: r.text
			.replace(party.members[r.a].narrative.name.given, '[a]')
			.replace(party.members[r.b].narrative.name.given, '[b]')
	}));
}

export const REROLL_TRIES = 64;

/** Rerolls a target until it differs, advancing its paths' nonces each try (at most `tries`). */
export function rerollPartyDistinct(
	recipe: Recipe,
	target: PartyTarget,
	current: Party,
	catalog: Catalog,
	opts: PartyGenerateOptions = {},
	tries = REROLL_TRIES
): Generated<Party> {
	const before = partyValueText(current, target);
	const paths = partyPaths(current, target);
	let next = recipe;
	let out: Generated<Party> | undefined;
	for (let i = 0; i < tries; i++) {
		for (const path of paths) next = rerollField(next, path);
		out = generateParty(next, catalog, opts);
		if (partyValueText(out.value, target) !== before) return out;
	}
	return out!;
}

/**
 * Replaces a whole-member lock (`m<i>`, the member's JSON) with one lock per field, so one field of that member can
 * be rerolled or unlocked while the rest stays as it is. The archetype and power become the member's options.
 */
export function explodeMemberLock(recipe: Recipe, party: Party, i: number): Recipe {
	const key = memberKey(i);
	if (!isLocked(recipe, key)) return recipe;
	const m = party.members[i];
	let out = unlockField(recipe, key);
	for (const f of NARRATIVE_FIELDS) {
		const value = lockValueOf(m, f);
		if (value !== undefined) out = lockField(out, memberPath(i, f), value);
	}
	if (m.profile) {
		out = lockField(out, memberPath(i, 'archetype'), m.profile.archetype);
		out = lockField(out, memberPath(i, 'power'), m.profile.power);
		for (const f of PROFILE_FIELDS) {
			if (f !== 'archetype') out = lockField(out, memberPath(i, f), m.profile[f]);
		}
	}
	return out;
}

/**
 * The Tier 2 recipe that regenerates one member on its own: the member's seed, archetype and power as options, its
 * field nonces and locks. A member locked as a whole is exploded first, so the result is the same NPC. Saving or
 * opening this recipe gives an NPC that no longer follows the party.
 */
export function standaloneMemberRecipe(recipe: Recipe, party: Party, i: number): Recipe {
	const m = party.members[i];
	const base = explodeMemberLock(recipe, party, i);
	return memberRecipe(base, i, {
		power: m.profile?.power ?? recipe.options.power,
		archetype: m.profile?.archetype ?? 'any'
	});
}

/** Member indices in display order: the leader first, the others as generated. */
export function memberOrder(party: Party): number[] {
	return [
		party.leaderIndex,
		...party.members.map((_, i) => i).filter((i) => i !== party.leaderIndex)
	];
}

/** The recipe of a party built around one combat NPC: the NPC becomes member 0 and is locked there. */
export function promoteToParty(recipe: Recipe, npc: Npc): Recipe {
	return {
		...recipe,
		tier: 3,
		nonces: {},
		locks: { [memberKey(0)]: npc },
		options: { ...recipe.options, archetype: 'any' }
	};
}
