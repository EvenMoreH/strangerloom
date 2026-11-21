// Tier 1: the narrative layer. Every field draws from its own stream; a locked field keeps its value.
import { isLocked } from './recipe';
import { int, pickWeighted, stream, type Rng } from './rng';
import {
	NARRATIVE_FIELDS,
	type Gender,
	type Narrative,
	type NarrativeField,
	type NpcAge,
	type NpcName,
	type Preset,
	type PresetFile,
	type Recipe
} from './schema';
import type { GenContext, TableSet } from './tables';
import { Expander } from './template';

export interface Catalog {
	presets: PresetFile;
	tables: TableSet;
}

export interface GenerateOptions {
	/** Returns true when a value should not be used (already seen this session). The field is then drawn again
	 *  from its next stream and the recipe keeps the new nonce. */
	avoid?: (field: NarrativeField, value: string) => boolean;
}

export interface Generated<T> {
	value: T;
	/** The recipe, with nonces advanced by duplicate avoidance. */
	recipe: Recipe;
}

const AVOID_TRIES = 8;

export function presetOf(catalog: Catalog, id: string): Preset {
	const preset = catalog.presets.presets.find((p) => p.id === id);
	if (!preset) throw new Error(`Unknown preset "${id}".`);
	return preset;
}

/** Ancestries a recipe may draw: the preset's list narrowed by the filter. */
export function allowedAncestries(preset: Preset, recipe: Recipe): { id: string; w: number }[] {
	const filter = recipe.filters.ancestries;
	const list = filter.length
		? preset.ancestries.filter((a) => filter.includes(a.id))
		: preset.ancestries;
	return list.length ? list : preset.ancestries;
}

function pickGender(rng: Rng): Gender {
	const roll = rng();
	return roll < 0.45 ? 'f' : roll < 0.9 ? 'm' : 'n';
}

export function formatFullName(given: string, family: string, extra: string): string {
	return [given, extra && `“${extra}”`, family].filter(Boolean).join(' ');
}

class FieldDrawer {
	constructor(
		private recipe: Recipe,
		private opts: GenerateOptions
	) {}

	get result(): Recipe {
		return this.recipe;
	}

	/** Draws a field: the lock if present, else `draw(rng)` on the field's stream, re-drawn while `avoid` says so. */
	field<T>(path: NarrativeField, draw: (rng: Rng) => T, text: (v: T) => string = String): T {
		if (isLocked(this.recipe, path)) return this.recipe.locks[path] as T;
		let nonce = this.recipe.nonces[path] ?? 0;
		let value = draw(stream(this.recipe.seed, path, nonce));
		if (this.opts.avoid) {
			for (let i = 0; i < AVOID_TRIES && this.opts.avoid(path, text(value)); i++) {
				nonce++;
				value = draw(stream(this.recipe.seed, path, nonce));
			}
			if (nonce !== (this.recipe.nonces[path] ?? 0)) {
				this.recipe = { ...this.recipe, nonces: { ...this.recipe.nonces, [path]: nonce } };
			}
		}
		return value;
	}
}

/** Generates the narrative layer of one NPC. `pathPrefix` scopes the streams of a party member. */
export function generateNarrative(
	recipe: Recipe,
	catalog: Catalog,
	opts: GenerateOptions = {}
): Generated<Narrative> {
	const preset = presetOf(catalog, recipe.preset);
	const tables = catalog.tables;
	const drawer = new FieldDrawer(recipe, opts);
	const ctx: GenContext = {
		preset: preset.id,
		tier: recipe.tier,
		tone: recipe.filters.tone.length ? recipe.filters.tone : preset.tone
	};
	const expander = (rng: Rng) => new Expander(tables, ctx, rng);
	const line = (field: NarrativeField, table: string) =>
		drawer.field(field, (rng) => expander(rng).fromTable(table).value);

	const ancestry = drawer.field('ancestry', (rng) => {
		const fixed = recipe.options.ancestry;
		const allowed = allowedAncestries(preset, recipe);
		if (fixed !== 'any' && allowed.some((a) => a.id === fixed)) return fixed;
		return pickWeighted(rng, allowed, (a) => a.w).id;
	});
	ctx.ancestry = ancestry;

	const gender = drawer.field('gender', (rng) =>
		recipe.options.gender === 'any' ? pickGender(rng) : recipe.options.gender
	);
	ctx.gender = gender;
	ctx.sex = gender === 'n' ? (stream(recipe.seed, 'sex', 0)() < 0.5 ? 'f' : 'm') : gender;

	let culture: string | undefined;
	if (preset.cultures.length) {
		culture = drawer.field('culture', (rng) => {
			const fixed = recipe.options.culture;
			if (fixed !== 'any' && preset.cultures.includes(fixed)) return fixed;
			return preset.cultures[int(rng, 0, preset.cultures.length - 1)];
		});
		ctx.culture = culture;
		ctx.alt =
			recipe.options.culture !== 'any' && preset.cultures.includes(recipe.options.culture)
				? recipe.options.culture
				: preset.cultures[int(stream(recipe.seed, 'alt', 0), 0, preset.cultures.length - 1)];
	}

	const name = drawer.field(
		'name',
		(rng): NpcName => {
			const ex = expander(rng);
			for (let attempt = 0; attempt < 30; attempt++) {
				const given = ex.fromTable('name.given').value;
				const family =
					tables.has('name.family') && tables.entries('name.family', ctx).length
						? ex.fromTable('name.family').value
						: '';
				let extra = '';
				let extraLabel = '';
				if (tables.has('name.extra') && tables.entries('name.extra', ctx).length) {
					const drawn = ex.fromTable('name.extra');
					const meta = (drawn.entry.meta ?? {}) as { label?: string; chance?: number };
					if (rng() < (meta.chance ?? 1)) {
						extra = drawn.value;
						extraLabel = meta.label ?? '';
					}
				}
				const words = given.toLowerCase().split(/[\s-]+/);
				const clash = [family, extra].some((part) => part && words.includes(part.toLowerCase()));
				if (!clash)
					return { given, family, extra, extraLabel, full: formatFullName(given, family, extra) };
			}
			const given = ex.fromTable('name.given').value;
			return { given, family: '', extra: '', extraLabel: '', full: given };
		},
		(n) => n.full
	);

	const pronouns = line('pronouns', 'pronouns');

	const age = drawer.field(
		'age',
		(rng): NpcAge => {
			const ex = expander(rng);
			const drawn = ex.fromTable('age.stage');
			const meta = (drawn.entry.meta ?? {}) as { min?: number; max?: number };
			const scale = catalog.presets.ancestries[ancestry]?.ageScale ?? 1;
			const years = Math.round(int(rng, meta.min ?? 18, meta.max ?? 60) * scale);
			return { stage: drawn.value, years };
		},
		(a) => a.stage
	);
	ctx.age = age.stage;

	const occupation = line('occupation', 'occupation');
	const quirk = line('quirk', 'quirk');
	const visual = line('visual', 'visual');
	const trait = line('trait', 'trait');
	const ideal = line('ideal', 'ideal');
	const bond = line('bond', 'bond');
	const flaw = line('flaw', 'flaw');
	const voice = line('voice', 'voice');
	const mood = line('mood', 'mood');
	const attitude = line('attitude', 'attitude');
	const secret = line('secret', 'secret');

	return {
		value: {
			ancestry,
			gender,
			pronouns,
			...(culture ? { culture } : {}),
			name,
			age,
			occupation,
			quirk,
			visual,
			trait,
			ideal,
			bond,
			flaw,
			voice,
			mood,
			attitude,
			secret
		},
		recipe: drawer.result
	};
}

/** The text shown for a field, used for locks, duplicate avoidance and copy. */
export function fieldText(npc: Narrative, field: NarrativeField): string {
	switch (field) {
		case 'name':
			return npc.name.full;
		case 'age':
			return `${npc.age.stage}, ${npc.age.years}`;
		case 'culture':
			return npc.culture ?? '';
		default:
			return String(npc[field] ?? '');
	}
}

export { NARRATIVE_FIELDS };
