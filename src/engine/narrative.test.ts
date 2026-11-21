import { describe, expect, it } from 'vitest';
import { catalogFor, PRESETS } from '../content';
import { fieldText, generateNarrative } from './narrative';
import { lockField, newRecipe, rerollField } from './recipe';
import { Narrative, NARRATIVE_FIELDS, type Gender } from './schema';

const SEEDS = ['7KQ2M9XA', 'AAAAAAAA', 'ZZZZZZZZ', '01234567', 'HE110123'];

describe('generateNarrative', () => {
	it('is deterministic for the same recipe', () => {
		const recipe = newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const a = generateNarrative(recipe, catalogFor('high-fantasy'));
		const b = generateNarrative(recipe, catalogFor('high-fantasy'));
		expect(a.value).toEqual(b.value);
		expect(a.recipe).toEqual(recipe);
		expect(Narrative.parse(a.value)).toEqual(a.value);
	});

	it('rerolling one field moves only that field', () => {
		const recipe = newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const before = generateNarrative(recipe, catalogFor('high-fantasy')).value;
		const after = generateNarrative(rerollField(recipe, 'quirk'), catalogFor('high-fantasy')).value;
		expect(after.quirk).not.toBe(before.quirk);
		expect({ ...after, quirk: '' }).toEqual({ ...before, quirk: '' });
	});

	it('a locked field keeps its value when everything else changes', () => {
		const recipe = lockField(
			newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' }),
			'occupation',
			'Farrier'
		);
		const npc = generateNarrative(
			{ ...recipe, seed: 'AAAAAAAA' },
			catalogFor('high-fantasy')
		).value;
		expect(npc.occupation).toBe('Farrier');
	});

	it('honours fixed ancestry, gender and culture', () => {
		const recipe = newRecipe({
			tier: 1,
			preset: 'modern',
			seed: '7KQ2M9XA',
			options: { ancestry: 'dwarf', gender: 'f', culture: 'polish' }
		});
		const npc = generateNarrative(recipe, catalogFor('modern')).value;
		expect(npc.ancestry).toBe('dwarf');
		expect(npc.gender).toBe('f');
		expect(npc.culture).toBe('polish');
		expect(npc.pronouns).toBe('she/her');
	});

	it('restricts ancestry by filter', () => {
		const catalog = catalogFor('high-fantasy');
		for (const seed of SEEDS) {
			const recipe = newRecipe({
				tier: 1,
				preset: 'high-fantasy',
				seed,
				filters: { ancestries: ['elf', 'orc'] }
			});
			expect(['elf', 'orc']).toContain(generateNarrative(recipe, catalog).value.ancestry);
		}
	});

	it('scales age by ancestry', () => {
		const human = generateNarrative(
			newRecipe({
				tier: 1,
				preset: 'high-fantasy',
				seed: '7KQ2M9XA',
				options: { ancestry: 'human' }
			}),
			catalogFor('high-fantasy')
		).value.age;
		const elf = generateNarrative(
			newRecipe({
				tier: 1,
				preset: 'high-fantasy',
				seed: '7KQ2M9XA',
				options: { ancestry: 'elf' }
			}),
			catalogFor('high-fantasy')
		).value.age;
		expect(elf.stage).toBe(human.stage);
		expect(elf.years).toBe(Math.round(human.years * 6));
	});

	it('duplicate avoidance advances the nonce and keeps the result reproducible', () => {
		const catalog = catalogFor('high-fantasy');
		const recipe = newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const first = generateNarrative(recipe, catalog).value;
		const avoided = generateNarrative(recipe, catalog, {
			avoid: (field, value) => field === 'name' && value === first.name.full
		});
		expect(avoided.value.name.full).not.toBe(first.name.full);
		expect(avoided.recipe.nonces.name).toBe(1);
		expect(generateNarrative(avoided.recipe, catalog).value).toEqual(avoided.value);
	});

	it('fieldText covers every field', () => {
		const npc = generateNarrative(
			newRecipe({ tier: 1, preset: 'sci-fi', seed: '7KQ2M9XA' }),
			catalogFor('sci-fi')
		).value;
		for (const field of NARRATIVE_FIELDS) expect(typeof fieldText(npc, field)).toBe('string');
		expect(fieldText(npc, 'name')).toBe(npc.name.full);
	});
});

describe('built-in content', () => {
	const genders: (Gender | 'any')[] = ['f', 'm', 'n', 'any'];

	for (const preset of PRESETS.presets) {
		it(`${preset.id}: every ancestry and gender generates without a template error`, () => {
			const catalog = catalogFor(preset.id);
			for (const { id: ancestry } of preset.ancestries) {
				for (const gender of genders) {
					for (const seed of SEEDS) {
						const recipe = newRecipe({
							tier: 1,
							preset: preset.id,
							seed,
							options: { ancestry, gender }
						});
						const npc = generateNarrative(recipe, catalog).value;
						expect(npc.name.given.length).toBeGreaterThan(1);
						expect(npc.name.full).not.toMatch(/[{}$]/);
						for (const field of NARRATIVE_FIELDS)
							expect(fieldText(npc, field)).not.toMatch(/[{}$]/);
						expect(npc.occupation).not.toBe('');
					}
				}
			}
		});
	}

	it('every preset names only bundled ancestries and cultures', () => {
		for (const preset of PRESETS.presets) {
			for (const a of preset.ancestries) expect(PRESETS.ancestries[a.id]).toBeDefined();
			for (const c of preset.cultures) expect(PRESETS.cultures[c]).toBeDefined();
		}
	});
});
