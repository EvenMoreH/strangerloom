import { describe, expect, it } from 'vitest';
import { catalogFor, PRESETS } from '../content';
import { renderGeneric } from './adapter';
import { demote, fieldValueText, generateNpc, promote, rerollDistinct } from './npc';
import { archetypeChoices, threatFor } from './profile';
import { lockField, newRecipe, rerollField } from './recipe';
import { Attack, Npc, Profile, PROFILE_FIELDS } from './schema';
import { BUILT_IN_PACKS } from '../content';

const SEEDS = ['7KQ2M9XA', 'AAAAAAAA', 'ZZZZZZZZ', '01234567', 'HE110123', 'Q9Q9Q9Q9'];

describe('threatFor', () => {
	it('maps power bands', () => {
		expect([1, 2, 3, 6, 7, 8, 9, 10].map(threatFor)).toEqual([
			'minion',
			'minion',
			'standard',
			'standard',
			'elite',
			'elite',
			'boss',
			'boss'
		]);
	});
});

describe('generateNpc at tier 2', () => {
	const catalog = catalogFor('high-fantasy');

	it('is deterministic and validates', () => {
		const recipe = newRecipe({ tier: 2, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const a = generateNpc(recipe, catalog).value;
		const b = generateNpc(recipe, catalog).value;
		expect(a).toEqual(b);
		expect(Npc.parse(a)).toEqual(a);
		expect(a.profile).toBeDefined();
	});

	it('promotion keeps the narrative layer', () => {
		const t1 = newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const n1 = generateNpc(t1, catalog).value;
		const n2 = generateNpc(promote(t1), catalog).value;
		expect(n2.tier).toBe(2);
		expect(n2.narrative).toEqual(n1.narrative);
		expect(generateNpc(demote(promote(t1)), catalog).value).toEqual(n1);
	});

	it('the occupation picks the archetype when one claims it', () => {
		const recipe = lockField(
			newRecipe({ tier: 2, preset: 'high-fantasy', seed: '7KQ2M9XA' }),
			'occupation',
			'Town guard'
		);
		expect(generateNpc(recipe, catalog).value.profile!.archetype).toBe('guard');
		const nun = lockField(recipe, 'occupation', 'Nun');
		expect(generateNpc(nun, catalog).value.profile!.archetype).toBe('healer');
	});

	it('a fixed archetype wins over the occupation', () => {
		const recipe = lockField(
			newRecipe({
				tier: 2,
				preset: 'high-fantasy',
				seed: '7KQ2M9XA',
				options: { archetype: 'mage' }
			}),
			'occupation',
			'Town guard'
		);
		const p = generateNpc(recipe, catalog).value.profile!;
		expect(p.archetype).toBe('mage');
		expect(p.tags).toContain('spellcaster');
		expect(p.attacks[0].kind).toBe('ranged');
	});

	it('power and threat options drive counts', () => {
		const minion = generateNpc(
			newRecipe({ tier: 2, preset: 'high-fantasy', seed: 'AAAAAAAA', options: { power: 1 } }),
			catalog
		).value.profile!;
		const boss = generateNpc(
			newRecipe({ tier: 2, preset: 'high-fantasy', seed: 'AAAAAAAA', options: { power: 10 } }),
			catalog
		).value.profile!;
		expect(minion.threat).toBe('minion');
		expect(minion.abilities).toHaveLength(1);
		expect(boss.threat).toBe('boss');
		expect(boss.abilities).toHaveLength(3);
		expect(boss.gear).toHaveLength(4);
		const forced = generateNpc(
			newRecipe({
				tier: 2,
				preset: 'high-fantasy',
				seed: 'AAAAAAAA',
				options: { power: 3, threat: 'boss' }
			}),
			catalog
		).value.profile!;
		expect(forced.threat).toBe('boss');
		expect(forced.power).toBe(3);
	});

	it('rerolling a profile field moves only that field; rerolling the archetype moves what depends on it', () => {
		const recipe = newRecipe({ tier: 2, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const base = generateNpc(recipe, catalog).value;
		const gear = generateNpc(rerollField(recipe, 'gear'), catalog).value;
		expect(gear.profile!.gear).not.toEqual(base.profile!.gear);
		expect({ ...gear.profile!, gear: [] }).toEqual({ ...base.profile!, gear: [] });
		expect(gear.narrative).toEqual(base.narrative);
	});

	it('abilities are distinct and attacks have at least one entry', () => {
		for (const preset of PRESETS.presets) {
			const cat = catalogFor(preset.id);
			for (const { id } of archetypeChoices(cat, preset.id)) {
				for (const seed of SEEDS) {
					for (const power of [1, 5, 10]) {
						const npc = generateNpc(
							newRecipe({ tier: 2, preset: preset.id, seed, options: { archetype: id, power } }),
							cat
						).value;
						const p = Profile.parse(npc.profile);
						expect(p.archetype).toBe(id);
						expect(new Set(p.abilities.map((a) => a.id)).size).toBe(p.abilities.length);
						const sig = { minion: 0, standard: 1, elite: 1, boss: 1 }[p.threat];
						const area = { minion: 0, standard: 0, elite: 1, boss: 2 }[p.threat];
						expect(p.attacks.length).toBe(2 + sig + area);
						expect(new Set(p.attacks.map((a) => a.name)).size).toBe(p.attacks.length);
						const basics = p.attacks.slice(0, 2);
						expect(basics.map((a) => a.kind).sort()).toEqual(['melee', 'ranged']);
						expect(basics.every((a) => a.use === 'basic' && !a.rider && !a.trigger)).toBe(true);
						const rest = p.attacks.slice(2);
						expect(rest.every((a) => a.use === 'signature' && a.trigger)).toBe(true);
						expect(rest.filter((a) => a.kind !== 'area').length).toBe(sig);
						expect(rest.filter((a) => a.kind === 'area').length).toBe(area);
						expect(p.gear.length).toBeGreaterThan(0);
						expect(p.tactics).not.toBe('');
						for (const field of PROFILE_FIELDS) expect(field in p).toBe(true);
					}
				}
			}
		}
	});

	it('setting-bound abilities stay in their settings', () => {
		const pool = (preset: string, archetype: string) =>
			catalogFor(preset)
				.tables.entries('ability', { preset, archetype })
				.map((e) => e.v);
		expect(pool('high-fantasy', 'mage')).not.toContain('jam');
		expect(pool('grimdark', 'mage')).not.toContain('jam');
		expect(pool('modern', 'mage')).not.toContain('jam');
		expect(pool('sci-fi', 'mage')).toContain('jam');
		expect(pool('modern', 'hacker')).toContain('jam');
		expect(pool('sci-fi', 'hacker')).toContain('jam');
	});

	it('every preset offers archetypes with labels', () => {
		for (const preset of PRESETS.presets) {
			const choices = archetypeChoices(catalogFor(preset.id), preset.id);
			expect(choices.length).toBeGreaterThanOrEqual(8);
			for (const c of choices) expect(c.label).not.toBe('');
		}
	});
});

describe('renderGeneric', () => {
	it('renders every section from the profile', () => {
		const npc = generateNpc(
			newRecipe({ tier: 2, preset: 'sci-fi', seed: '7KQ2M9XA', options: { power: 7 } }),
			catalogFor('sci-fi')
		).value;
		const block = renderGeneric(npc);
		expect(block.title).toBe(npc.narrative.name.full);
		expect(block.sections.map((s) => s.id)).toEqual([
			'header',
			'competencies',
			'offence',
			'abilities',
			'gear',
			'tactics'
		]);
		const comp = block.sections[1].lines;
		expect(comp).toHaveLength(6);
		expect(comp[0].value).toMatch(/^[●○]{5}$/);
		expect(block.sections[2].lines).toHaveLength(npc.profile!.attacks.length);
		expect(block.sections[2].lines.map((l) => l.label)).toEqual(
			npc.profile!.attacks.map((a) => a.name)
		);
		expect(block.sections[3].lines).toHaveLength(npc.profile!.abilities.length);
	});

	it('anchors signature attacks per line and basic attacks in the section legend', () => {
		const npc = generateNpc(
			newRecipe({ tier: 2, preset: 'modern', seed: '7KQ2M9XA', options: { power: 10 } }),
			catalogFor('modern')
		).value;
		const anchors = { light: 'a knife', medium: 'a pistol', heavy: 'a shotgun' };
		const offence = renderGeneric(npc, { anchors }).sections.find((s) => s.id === 'offence')!;
		expect(offence.note).toBe(
			'Light damage is like a knife, medium like a pistol, heavy like a shotgun.'
		);
		for (const [i, a] of npc.profile!.attacks.entries()) {
			const line = offence.lines[i];
			if (a.use === 'basic') expect(line.value).not.toContain('like');
			else expect(line.value).toContain(`like ${a.anchor}`);
		}
	});

	it('refuses a tier 1 NPC', () => {
		const npc = generateNpc(
			newRecipe({ tier: 1, preset: 'modern', seed: '7KQ2M9XA' }),
			catalogFor('modern')
		).value;
		expect(() => renderGeneric(npc)).toThrow('no profile');
	});
});

describe('rerollDistinct', () => {
	const catalog = catalogFor('high-fantasy');
	const fields = ['gender', 'ancestry', 'age', 'defence', 'abilities', 'loot', 'name'] as const;

	it('always changes a field that has more than one value', () => {
		for (const seed of SEEDS) {
			let recipe = newRecipe({ tier: 2, preset: 'high-fantasy', seed });
			let npc = generateNpc(recipe, catalog).value;
			for (const field of fields) {
				for (let i = 0; i < 5; i++) {
					const before = fieldValueText(npc, field);
					const out = rerollDistinct(recipe, field, npc, catalog);
					expect(fieldValueText(out.value, field), `${seed} ${field}`).not.toBe(before);
					// Every other field keeps its value; the name follows ancestry and gender.
					for (const other of fields) {
						if (other === field) continue;
						if (other === 'name' && (field === 'ancestry' || field === 'gender')) continue;
						if (other === 'age' && field === 'ancestry') continue; // years scale with the ancestry
						expect(fieldValueText(out.value, other), `${field} moved ${other}`).toBe(
							fieldValueText(npc, other)
						);
					}
					recipe = out.recipe;
					npc = out.value;
				}
			}
			// The result is reproducible from the recipe alone.
			expect(generateNpc(recipe, catalog).value).toEqual(npc);
		}
	});

	it('the ancestry row rerolls the culture where the preset has cultures', () => {
		const modern = catalogFor('modern');
		let recipe = newRecipe({ tier: 1, preset: 'modern', seed: '7KQ2M9XA' });
		let npc = generateNpc(recipe, modern).value;
		expect(npc.narrative.culture).toBeDefined();
		for (let i = 0; i < 5; i++) {
			const out = rerollDistinct(recipe, 'ancestry', npc, modern);
			expect(fieldValueText(out.value, 'ancestry')).not.toBe(fieldValueText(npc, 'ancestry'));
			expect(out.recipe.nonces.culture).toBeGreaterThan(recipe.nonces.culture ?? 0);
			recipe = out.recipe;
			npc = out.value;
		}
	});

	it('gives up on a field that cannot change', () => {
		const recipe = {
			...newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' }),
			options: { ...newRecipe({ tier: 1, preset: 'high-fantasy' }).options, gender: 'f' as const }
		};
		const npc = generateNpc(recipe, catalog).value;
		const out = rerollDistinct(recipe, 'gender', npc, catalog);
		expect(out.value.narrative.gender).toBe('f');
		expect(out.recipe.nonces.gender).toBe(64);
	});
});

describe('attack table', () => {
	it('every entry uses the attack vocabulary', () => {
		const core = BUILT_IN_PACKS.find((p) => p.id === 'core')!;
		for (const entry of core.tables.attack.entries) {
			const e = typeof entry === 'string' ? { v: entry } : entry;
			const m = (e.meta ?? {}) as Record<string, unknown>;
			const parsed = Attack.safeParse({
				name: e.v,
				kind: m.kind,
				damage: m.damage,
				use: m.use,
				range: m.range,
				damageType: m.type,
				rider: m.rider,
				trigger: m.trigger,
				anchor: m.anchor
			});
			expect(parsed.success, `${e.v}: ${parsed.error?.message}`).toBe(true);
			const a = parsed.data!;
			if (a.use === 'basic') expect(a.rider, `${a.name} is basic`).toBeUndefined();
			if (a.use === 'signature') {
				expect(a.trigger, `${a.name} needs a trigger`).toBeTruthy();
				expect(a.anchor, `${a.name} needs an anchor`).toBeTruthy();
			} else {
				expect(a.anchor, `${a.name} is basic`).toBeUndefined();
			}
			if (a.kind === 'area') expect(a.use).toBe('signature');
		}
	});
});
