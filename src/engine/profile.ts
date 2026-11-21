// Tier 2: the abstract capability profile. Archetype, threat and power drive the rest; every field has its own stream.
import type { Catalog } from './narrative';
import { presetOf } from './narrative';
import { isLocked } from './recipe';
import { chance, int, pickWeighted, stream, type Rng } from './rng';
import {
	ArchetypeMeta,
	COMPETENCIES,
	type Ability,
	type Attack,
	type Competencies,
	type EntryObject,
	type Narrative,
	type Profile,
	type ProfileField,
	type Recipe,
	type Threat
} from './schema';
import { weightOf, type GenContext } from './tables';
import { Expander } from './template';

/** Threat from power when the option is `auto`. */
export function threatFor(power: number): Threat {
	if (power <= 2) return 'minion';
	if (power <= 6) return 'standard';
	if (power <= 8) return 'elite';
	return 'boss';
}

const ABILITY_COUNT: Record<Threat, [number, number]> = {
	minion: [1, 1],
	standard: [1, 2],
	elite: [2, 3],
	boss: [3, 3]
};

/** Every NPC lists a basic melee and a basic ranged option. Signature moves and area options come by threat. */
const SIGNATURE_COUNT: Record<Threat, number> = { minion: 0, standard: 1, elite: 1, boss: 1 };
const AREA_COUNT: Record<Threat, number> = { minion: 0, standard: 0, elite: 1, boss: 2 };

/** Archetype entries a recipe may draw: the preset's, narrowed by the filter. */
export function allowedArchetypes(
	catalog: Catalog,
	recipe: Recipe,
	ctx: GenContext
): EntryObject[] {
	const all = catalog.tables.entries('archetype', ctx);
	const filter = recipe.filters.archetypes;
	const list = filter.length ? all.filter((e) => filter.includes(e.v)) : all;
	return list.length ? list : all;
}

/** The archetype an occupation promotes to, when one claims it. */
export function archetypeForOccupation(
	entries: EntryObject[],
	occupation: string
): string | undefined {
	return entries.find((e) => ArchetypeMeta.parse(e.meta ?? {}).occupations.includes(occupation))?.v;
}

function drawDistinct<T extends EntryObject>(rng: Rng, entries: T[], count: number): T[] {
	const pool = [...entries];
	const out: T[] = [];
	while (out.length < count && pool.length) {
		const pick = pickWeighted(rng, pool, weightOf);
		out.push(pick);
		pool.splice(pool.indexOf(pick), 1);
	}
	return out;
}

class ProfileDrawer {
	constructor(private recipe: Recipe) {}
	get result() {
		return this.recipe;
	}
	field<T>(path: ProfileField, draw: (rng: Rng) => T): T {
		if (isLocked(this.recipe, path)) return this.recipe.locks[path] as T;
		return draw(stream(this.recipe.seed, path, this.recipe.nonces[path] ?? 0));
	}
}

/** Generates the profile of one NPC from its recipe and narrative layer. */
export function generateProfile(recipe: Recipe, narrative: Narrative, catalog: Catalog): Profile {
	const preset = presetOf(catalog, recipe.preset);
	const tables = catalog.tables;
	const drawer = new ProfileDrawer(recipe);
	const ctx: GenContext = {
		preset: preset.id,
		tier: recipe.tier,
		ancestry: narrative.ancestry,
		gender: narrative.gender,
		tone: recipe.filters.tone.length ? recipe.filters.tone : preset.tone
	};

	const power = recipe.options.power;
	const threat = recipe.options.threat === 'auto' ? threatFor(power) : recipe.options.threat;

	const archetypeEntries = allowedArchetypes(catalog, recipe, ctx);
	const archetypeEntry = drawer.field('archetype', (rng) => {
		const fixed = recipe.options.archetype;
		const byOption = fixed !== 'any' ? archetypeEntries.find((e) => e.v === fixed) : undefined;
		if (byOption) return byOption;
		const byOccupation = archetypeForOccupation(archetypeEntries, narrative.occupation);
		const matched = byOccupation ? archetypeEntries.find((e) => e.v === byOccupation) : undefined;
		return matched ?? pickWeighted(rng, archetypeEntries, weightOf);
	});
	const meta = ArchetypeMeta.parse(archetypeEntry.meta ?? {});
	ctx.archetype = archetypeEntry.v;
	ctx.role = meta.role;

	const competencies = drawer.field('competencies', (rng): Competencies => {
		const c = { ...meta.competencies };
		const primary = COMPETENCIES.reduce((best, k) => (c[k] > c[best] ? k : best), COMPETENCIES[0]);
		if (power >= 8) c[primary] = Math.min(5, c[primary] + 1);
		if (power <= 2) c[primary] = Math.max(0, c[primary] - 1);
		// One secondary competency drifts by one in either direction.
		const others = COMPETENCIES.filter((k) => k !== primary);
		const drift = others[int(rng, 0, others.length - 1)];
		c[drift] = Math.max(0, Math.min(5, c[drift] + (chance(rng, 0.5) ? 1 : -1)));
		return c;
	});

	const defence = drawer.field('defence', (rng) =>
		chance(rng, 0.8)
			? meta.defence
			: (['hard-to-hit', 'hard-to-kill', 'evasive'] as const)[int(rng, 0, 2)]
	);

	const abilities = drawer.field('abilities', (rng): Ability[] => {
		const [lo, hi] = ABILITY_COUNT[threat];
		const pool = tables.entries('ability', ctx);
		return drawDistinct(rng, pool, int(rng, lo, hi)).map((e) => {
			const m = (e.meta ?? {}) as { name?: string; text?: string; use?: Ability['use'] };
			return { id: e.v, name: m.name ?? e.v, text: m.text ?? '', use: m.use ?? 'at-will' };
		});
	});

	const attacks = drawer.field('attacks', (rng): Attack[] => {
		const pool = tables.entries('attack', ctx);
		const toAttack = (e: EntryObject): Attack => {
			const m = (e.meta ?? {}) as { type?: Attack['damageType'] } & Partial<Attack>;
			return {
				name: e.v,
				kind: m.kind ?? 'melee',
				damage: m.damage ?? 'medium',
				use: m.use ?? (m.kind === 'area' ? 'signature' : 'basic'),
				range: m.range ?? (m.kind === 'melee' ? 'close' : 'near'),
				...(m.type ? { damageType: m.type } : {}),
				...(m.rider ? { rider: m.rider } : {}),
				...(m.trigger ? { trigger: m.trigger } : {}),
				...(m.anchor ? { anchor: m.anchor } : {})
			};
		};
		const metaOf = (e: EntryObject) => (e.meta ?? {}) as Partial<Attack>;
		const kindOf = (e: EntryObject) => metaOf(e).kind ?? 'melee';
		const useOf = (e: EntryObject) =>
			metaOf(e).use ?? (kindOf(e) === 'area' ? 'signature' : 'basic');
		const basic = (kind: Attack['kind']) =>
			pool.filter((e) => kindOf(e) === kind && useOf(e) === 'basic');
		const moves = pool.filter((e) => kindOf(e) !== 'area' && useOf(e) === 'signature');
		const area = pool.filter((e) => kindOf(e) === 'area');
		const primaryRanged =
			meta.role === 'sniper' || meta.role === 'controller' || meta.tags.includes('ranged');
		const out: EntryObject[] = [];
		const take = (from: EntryObject[], count: number) => {
			const fresh = from.filter((e) => !out.some((o) => o.v === e.v));
			out.push(...drawDistinct(rng, fresh, count));
		};
		// A basic melee and a basic ranged option, the archetype's primary kind first; a missing kind is filled
		// from the other. Then signature moves and area options by threat, topped up from the moves when short.
		const ordered = primaryRanged
			? [basic('ranged'), basic('melee')]
			: [basic('melee'), basic('ranged')];
		take(ordered[0], 1);
		take(ordered[1], 1);
		if (out.length < 2) take([...ordered[0], ...ordered[1]], 2 - out.length);
		const wanted = 2 + SIGNATURE_COUNT[threat] + AREA_COUNT[threat];
		take(moves, SIGNATURE_COUNT[threat]);
		take(area, AREA_COUNT[threat]);
		if (out.length < wanted) take([...moves, ...area], wanted - out.length);
		return out.map(toAttack);
	});

	const gear = drawer.field('gear', (rng) => {
		const pool = tables.entries('gear', ctx);
		const count = threat === 'minion' ? 2 : threat === 'standard' ? 3 : 4;
		return drawDistinct(rng, pool, count).map((e) => e.v);
	});

	const loot = drawer.field('loot', (rng) => {
		const coinsPool = tables
			.table('loot.coins')
			.entries.filter((e) => (e.meta as { threat?: string } | undefined)?.threat === threat);
		const coins = pickWeighted(rng, coinsPool, weightOf).v as Profile['loot']['coins'];
		const itemCount = threat === 'minion' ? int(rng, 0, 1) : threat === 'boss' ? 2 : int(rng, 0, 2);
		const items = drawDistinct(rng, tables.entries('loot.item', ctx), itemCount).map((e) => e.v);
		return { coins, items };
	});

	const tactics = drawer.field(
		'tactics',
		(rng) => new Expander(tables, ctx, rng).fromTable('tactics').value
	);

	return {
		archetype: archetypeEntry.v,
		archetypeLabel: meta.label,
		threat,
		power,
		role: meta.role,
		competencies,
		defence,
		tags: [...meta.tags],
		abilities,
		attacks,
		gear,
		loot,
		tactics
	};
}

/** The archetypes a preset offers, for pickers: id and label, in table order. */
export function archetypeChoices(
	catalog: Catalog,
	presetId: string
): { id: string; label: string }[] {
	const seen = new Map<string, string>();
	for (const e of catalog.tables.entries('archetype', { preset: presetId })) {
		if (!seen.has(e.v)) seen.set(e.v, ArchetypeMeta.parse(e.meta ?? {}).label);
	}
	return [...seen].map(([id, label]) => ({ id, label }));
}
