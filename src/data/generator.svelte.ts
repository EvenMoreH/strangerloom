// Reactive state of the generate screen: the current recipe and the result it produces.
import { PRESETS } from '../content';
import { packs } from './packs.svelte';
import {
	AdapterError,
	applyOverrides,
	renderAdapter,
	renderGeneric,
	type Overrides,
	type StatBlock
} from '../engine/adapter';
import { fieldText } from '../engine/narrative';
import { generateNpc, lockValueOf, pathsOf, promote, rerollDistinct } from '../engine/npc';
import {
	explodeMemberLock,
	generateParty,
	memberKey,
	partyLockValue,
	partyPaths,
	promoteToParty,
	rerollPartyDistinct,
	type PartyTarget
} from '../engine/party';
import { archetypeChoices } from '../engine/profile';
import {
	decodeShare,
	encodeShare,
	isLocked,
	lockField,
	newRecipe,
	rerollAll,
	rerollField,
	unlockField,
	withPacks,
	type Recipe
} from '../engine/recipe';
import { newSeed, normalizeSeed } from '../engine/rng';
import type {
	NarrativeField,
	Npc,
	Party,
	Preset,
	ProfileField,
	RecipeFilters,
	RecipeOptions,
	TrackerState
} from '../engine/schema';
import { isSeen, remember as rememberSeen } from './session';

export type LockableField = NarrativeField | ProfileField;

const LAST_PRESET_KEY = 'strangerloom.lastPreset';
const LAST_ADAPTER_KEY = 'strangerloom.lastAdapter';

function readLastPreset(): string {
	try {
		const id = localStorage.getItem(LAST_PRESET_KEY);
		if (id && PRESETS.presets.some((p) => p.id === id)) return id;
	} catch {
		// localStorage unavailable
	}
	return PRESETS.presets[0].id;
}

function readLastAdapter(): string | undefined {
	try {
		const id = localStorage.getItem(LAST_ADAPTER_KEY);
		if (id === 'generic' || (id && packs.adapterById(id))) return id;
	} catch {
		// localStorage unavailable
	}
	return undefined;
}

function remember(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// localStorage unavailable
	}
}

/** Renders an NPC with the named adapter; the generic one when the id is unknown. */
function renderWith(
	npc: Npc,
	adapterId: string,
	anchors: Preset['damageAnchors'],
	overrides: Overrides
): { block: StatBlock | null; error: string | null } {
	if (!npc.profile) return { block: null, error: null };
	try {
		const pack = adapterId === 'generic' ? undefined : packs.adapterById(adapterId);
		const block = pack ? renderAdapter(pack, npc, { anchors }) : renderGeneric(npc, { anchors });
		return { block: applyOverrides(block, overrides), error: null };
	} catch (err) {
		if (err instanceof AdapterError) return { block: null, error: err.message };
		throw err;
	}
}

/** A field operation on a member locked as a whole first turns that lock into one lock per field. */
function freeMemberField(recipe: Recipe, party: Party, target: PartyTarget): Recipe {
	if ('member' in target && target.field) return explodeMemberLock(recipe, party, target.member);
	return recipe;
}

function createGenerator() {
	let recipe = $state<Recipe>(
		newRecipe({ tier: 1, preset: readLastPreset(), adapter: readLastAdapter() })
	);
	let npc = $state<Npc | null>(null);
	let party = $state<Party | null>(null);
	let error = $state<string | null>(null);
	/** Manual overrides of stat block lines, by adapter id then line id. They belong to the current seed. */
	let overrides = $state<Record<string, Overrides>>({});
	/** Tracker values of a saved NPC just opened, for the screen to apply once its tracker is bound. */
	let pendingTracker: TrackerState | null = null;

	const preset = $derived(
		PRESETS.presets.find((p) => p.id === recipe.preset) ?? PRESETS.presets[0]
	);
	const archetypes = $derived(archetypeChoices(packs.catalogFor(recipe.preset), recipe.preset));
	const adapters = $derived(packs.adapterChoices(recipe.preset));
	const adapter = $derived(
		recipe.adapter && adapters.some((a) => a.id === recipe.adapter)
			? recipe.adapter
			: preset.adapter
	);
	const rendered = $derived(
		npc
			? renderWith(npc, adapter, preset.damageAnchors, overrides[adapter] ?? {})
			: { block: null, error: null }
	);
	/** One stat block per party member, rendered with the current adapter (no overrides). */
	const memberBlocks = $derived(
		party ? party.members.map((m) => renderWith(m, adapter, preset.damageAnchors, {}).block) : []
	);

	/**
	 * Renders the current recipe. `fresh` switches on session duplicate avoidance: `true` for every field (a new
	 * seed), a field name for that field only (a reroll), `false` for none (shared, re-rendered or re-seeded recipes).
	 */
	function render(fresh: boolean | LockableField) {
		try {
			const catalog = packs.catalogFor(recipe.preset);
			const avoid =
				fresh === true
					? isSeen
					: fresh
						? (field: NarrativeField, value: string) => field === fresh && isSeen(field, value)
						: undefined;
			if (recipe.tier === 3) {
				const out = generateParty(recipe, catalog, fresh === true ? { avoid: isSeen } : {});
				recipe = withPacks(out.recipe, catalog.tables.versions);
				party = out.value;
				npc = null;
				error = null;
				if (fresh) for (const m of out.value.members) rememberSeen(m.narrative);
				return;
			}
			const out = generateNpc(recipe, catalog, avoid ? { avoid } : {});
			recipe = withPacks(out.recipe, catalog.tables.versions);
			npc = out.value;
			party = null;
			error = null;
			if (fresh) rememberSeen(out.value.narrative);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	return {
		get recipe() {
			return recipe;
		},
		get npc() {
			return npc;
		},
		get party() {
			return party;
		},
		get memberBlocks() {
			return memberBlocks;
		},
		get error() {
			return error;
		},
		get preset() {
			return preset;
		},
		get archetypes() {
			return archetypes;
		},
		get adapters() {
			return adapters;
		},
		/** The adapter in use: the recipe's when the preset allows it, else the preset's default. */
		get adapter() {
			return adapter;
		},
		/** The stat block of the current NPC for the current adapter, with overrides applied. Null at tier 1. */
		get block() {
			return rendered.block;
		},
		/** The adapter's error when it could not render. */
		get renderError() {
			return rendered.error;
		},
		get overrides(): Overrides {
			return overrides[adapter] ?? {};
		},
		/** Overrides of every adapter, as the library stores them. */
		get allOverrides(): Record<string, Overrides> {
			return overrides;
		},
		/** Opens a saved record: its recipe and overrides, no duplicate avoidance. */
		loadRecord(next: Recipe, saved: Record<string, Overrides> = {}, trackerState?: TrackerState) {
			recipe = next;
			overrides = saved;
			pendingTracker = trackerState ?? null;
			render(false);
		},
		takePendingTracker(): TrackerState | null {
			const t = pendingTracker;
			pendingTracker = null;
			return t;
		},
		setAdapter(id: string) {
			if (!adapters.some((a) => a.id === id)) return;
			recipe = { ...recipe, adapter: id };
			remember(LAST_ADAPTER_KEY, id);
		},
		/** Replaces a line's value for the current adapter; `null` removes the override. */
		setOverride(lineId: string, value: string | null) {
			const current = { ...(overrides[adapter] ?? {}) };
			if (value === null || value.trim() === '') delete current[lineId];
			else current[lineId] = value;
			overrides = { ...overrides, [adapter]: current };
		},
		clearOverrides() {
			overrides = {};
		},
		/** A new seed; locks stay. */
		generate() {
			recipe = rerollAll(recipe, newSeed());
			overrides = {};
			render(true);
		},
		/** Re-renders the current recipe without a new seed (used after an option change). */
		refresh() {
			render(false);
		},
		/** Rerolls one field to a value other than the one shown, when the field has more than one. */
		reroll(field: LockableField) {
			if (!npc) {
				recipe = rerollField(recipe, field);
				render(field);
				return;
			}
			try {
				const catalog = packs.catalogFor(recipe.preset);
				const paths = pathsOf(npc, field);
				const avoid = (f: NarrativeField, value: string) => paths.includes(f) && isSeen(f, value);
				const out = rerollDistinct(recipe, field, npc, catalog, { avoid });
				recipe = withPacks(out.recipe, catalog.tables.versions);
				npc = out.value;
				error = null;
				rememberSeen(out.value.narrative);
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
			}
		},
		/** Rerolls a party field, a whole member or one member field to something other than what is shown. */
		rerollParty(target: PartyTarget) {
			if (!party) return;
			try {
				const catalog = packs.catalogFor(recipe.preset);
				recipe = freeMemberField(recipe, party, target);
				// Only the rerolled member avoids values the session has seen; the others must stay as they are.
				const fields =
					'member' in target && target.field
						? pathsOf(party.members[target.member], target.field)
						: null;
				const avoid = (f: NarrativeField, value: string, member: number) =>
					'member' in target &&
					member === target.member &&
					(fields === null || fields.includes(f)) &&
					isSeen(f, value);
				const out = rerollPartyDistinct(recipe, target, party, catalog, { avoid });
				recipe = withPacks(out.recipe, catalog.tables.versions);
				party = out.value;
				error = null;
				for (const m of out.value.members) rememberSeen(m.narrative);
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
			}
		},
		togglePartyLock(target: PartyTarget) {
			if (!party) return;
			recipe = freeMemberField(recipe, party, target);
			const paths = partyPaths(party, target);
			if (paths.every((p) => isLocked(recipe, p))) {
				for (const p of paths) recipe = unlockField(recipe, p);
				if ('member' in target && target.field === 'archetype') render(false);
				return;
			}
			const value = partyLockValue(party, target, recipe);
			if (value === undefined) return;
			if ('member' in target && target.field && target.field !== 'archetype') {
				// Narrative rows may span two paths (ancestry and culture): lock each with its own value.
				const m = party.members[target.member];
				for (const p of pathsOf(m, target.field)) {
					recipe = lockField(recipe, `m${target.member}.${p}`, lockValueOf(m, p as LockableField));
				}
				return;
			}
			for (const p of paths) recipe = lockField(recipe, p, value);
		},
		isPartyLocked(target: PartyTarget) {
			if (!party) return false;
			// Every field of a member locked as a whole is locked.
			if ('member' in target && target.field && isLocked(recipe, memberKey(target.member)))
				return true;
			return partyPaths(party, target).every((p) => isLocked(recipe, p));
		},
		toggleLock(field: LockableField) {
			if (!npc) return;
			if (field === 'archetype') {
				// The archetype lock is the archetype option: it survives rerolls and keeps dependent fields free.
				// Unlocking sets the option back to "any" and re-renders, so the card shows what the recipe draws.
				const locked = recipe.options.archetype !== 'any';
				recipe = {
					...recipe,
					options: {
						...recipe.options,
						archetype: locked ? 'any' : (npc.profile?.archetype ?? 'any')
					}
				};
				if (locked) render(false);
				return;
			}
			if (isLocked(recipe, field)) {
				for (const path of pathsOf(npc, field)) recipe = unlockField(recipe, path);
				return;
			}
			for (const path of pathsOf(npc, field) as LockableField[]) {
				recipe = lockField(recipe, path, lockValueOf(npc, path));
			}
		},
		isLocked(field: LockableField) {
			if (field === 'archetype') return recipe.options.archetype !== 'any';
			return isLocked(recipe, field);
		},
		lockedText(field: NarrativeField) {
			return npc ? fieldText(npc.narrative, field) : '';
		},
		setTier(tier: 1 | 2 | 3) {
			if (tier === recipe.tier) return;
			recipe = { ...recipe, tier };
			render(false);
		},
		/** One tier up. From a combat NPC this builds a party around it: the NPC becomes member 0 and is locked. */
		promote() {
			if (recipe.tier === 2 && npc) recipe = promoteToParty(recipe, npc);
			else recipe = promote(recipe);
			overrides = {};
			render(false);
		},
		setPreset(id: string) {
			if (!PRESETS.presets.some((p) => p.id === id)) return;
			recipe = {
				...recipe,
				preset: id,
				options: { ...recipe.options, ancestry: 'any', culture: 'any', archetype: 'any' },
				locks: {}
			};
			remember(LAST_PRESET_KEY, id);
			render(false);
		},
		setOption<K extends keyof RecipeOptions>(key: K, value: RecipeOptions[K]) {
			recipe = { ...recipe, options: { ...recipe.options, [key]: value } };
			render(false);
		},
		/** Sets one filter list. An empty list means no filter (the preset's defaults). */
		setFilter<K extends keyof RecipeFilters>(key: K, values: RecipeFilters[K]) {
			recipe = { ...recipe, filters: { ...recipe.filters, [key]: values } };
			render(false);
		},
		clearFilters() {
			recipe = { ...recipe, filters: { ancestries: [], archetypes: [], tone: [] } };
			render(false);
		},
		/** Applies a typed seed. Returns false when it is not a seed. */
		applySeed(input: string): boolean {
			const seed = normalizeSeed(input);
			if (!seed) return false;
			recipe = { ...recipe, seed, nonces: {} };
			overrides = {};
			render(false);
			return true;
		},
		async loadShare(code: string): Promise<boolean> {
			try {
				recipe = await decodeShare(code);
				overrides = {};
				render(false);
				return true;
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
				return false;
			}
		},
		shareCode(): Promise<string> {
			return encodeShare(recipe);
		}
	};
}

export const generator = createGenerator();
