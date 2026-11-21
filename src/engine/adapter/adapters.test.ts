import { describe, expect, it } from 'vitest';
import { adapterChoices, BUILT_IN_ADAPTERS, catalogFor, PRESETS } from '../../content';
import { generateNpc } from '../npc';
import { archetypeChoices } from '../profile';
import { newRecipe } from '../recipe';
import { applyOverrides, pruneOverrides } from './overrides';
import { renderAdapter } from './render';
import { isDice } from '../dice';

const SEEDS = ['7KQ2M9XA', 'AAAAAAAA', 'ZZZZZZZZ'];

describe('built-in adapters', () => {
	it('render every archetype of every preset at every power without an error', () => {
		for (const adapter of BUILT_IN_ADAPTERS) {
			for (const preset of PRESETS.presets) {
				const catalog = catalogFor(preset.id);
				for (const { id } of archetypeChoices(catalog, preset.id)) {
					for (const seed of SEEDS) {
						for (const power of [1, 3, 5, 7, 10]) {
							const npc = generateNpc(
								newRecipe({ tier: 2, preset: preset.id, seed, options: { archetype: id, power } }),
								catalog
							).value;
							const block = renderAdapter(adapter, npc);
							expect(block.tracker.hpMax).toBeGreaterThan(0);
							const dice = adapter.id === 'd20' || adapter.id === 'osr';
							if (dice) {
								expect(block.tracker.hpRoll && isDice(block.tracker.hpRoll)).toBe(true);
								expect(block.tracker.initiative && isDice(block.tracker.initiative)).toBe(true);
							}
							const offence = block.sections.find((s) => s.id === 'offence')!;
							expect(offence.lines.length).toBe(npc.profile!.attacks.length);
							for (const line of offence.lines) {
								if (!dice) {
									expect(line.roll).toBeUndefined();
									expect(line.value).toMatch(/^(Melee|Ranged|Area), \w+\. .+\.$/);
									continue;
								}
								expect(line.roll && isDice(line.roll), `${adapter.id} ${line.label}`).toBe(true);
								expect(line.value).toMatch(
									/^Area/.test(line.value)
										? /^Area, \w+\. \d+d\d+(, [a-z]+)? damage\.$/
										: /to hit, \d+d\d+(\+\d+)?(, [a-z]+)? damage\.$/
								);
							}
							for (const line of block.sections.flatMap((s) => s.lines)) {
								expect(line.value, `${adapter.id} ${line.id}`).not.toMatch(/undefined|NaN|\{/);
								expect(line.note ?? '').not.toMatch(/undefined|NaN|\{/);
							}
						}
					}
				}
			}
		}
	});

	it('the d20 pack shows a spell save only for casters and scales with power', () => {
		const d20 = BUILT_IN_ADAPTERS.find((a) => a.id === 'd20')!;
		const catalog = catalogFor('high-fantasy');
		const at = (archetype: string, power: number) =>
			renderAdapter(
				d20,
				generateNpc(
					newRecipe({
						tier: 2,
						preset: 'high-fantasy',
						seed: 'AAAAAAAA',
						options: { archetype, power }
					}),
					catalog
				).value
			);
		const mage = at('mage', 5);
		const brute = at('brute', 5);
		const ids = (b: typeof mage) => b.sections.flatMap((s) => s.lines.map((l) => l.id));
		expect(ids(mage)).toContain('dc');
		expect(ids(brute)).not.toContain('dc');
		expect(at('brute', 10).tracker.hpMax).toBeGreaterThan(at('brute', 1).tracker.hpMax!);
		expect(mage.subtitle).toMatch(/^Mage \| CR \S+ \| Standard$/);
	});

	it('the osr pack shows descending and ascending armour class', () => {
		const osr = BUILT_IN_ADAPTERS.find((a) => a.id === 'osr')!;
		const npc = generateNpc(
			newRecipe({
				tier: 2,
				preset: 'high-fantasy',
				seed: 'AAAAAAAA',
				options: { archetype: 'knight' }
			}),
			catalogFor('high-fantasy')
		).value;
		const block = renderAdapter(osr, npc);
		const ac = block.sections.flatMap((s) => s.lines).find((l) => l.id === 'ac')!;
		expect(ac.value).toMatch(/^-?\d+ \[\d+\]$/);
		const [desc, asc] = ac.value.match(/-?\d+/g)!.map(Number);
		expect(desc + asc).toBe(19);
	});

	it('the narrative pack rates skills on the ladder and the stat-light pack lists moves from tags', () => {
		const catalog = catalogFor('high-fantasy');
		const npc = generateNpc(
			newRecipe({
				tier: 2,
				preset: 'high-fantasy',
				seed: 'AAAAAAAA',
				options: { archetype: 'knight', power: 9 }
			}),
			catalog
		).value;
		const narrative = renderAdapter(
			BUILT_IN_ADAPTERS.find((a) => a.id === 'narrative')!,
			npc
		);
		const skills = narrative.sections.find((s) => s.id === 'competencies')!.lines;
		expect(skills[0].value).toMatch(
			/^(Mediocre|Average|Fair|Good|Great|Superb|Fantastic|Epic|Legendary) \([+-]\d\)$/
		);
		expect(narrative.sections.find((s) => s.id === 'header')!.lines[1].value).toContain('Armoured');
		const light = renderAdapter(
			BUILT_IN_ADAPTERS.find((a) => a.id === 'stat-light')!,
			npc
		);
		const moves = light.sections
			.find((s) => s.id === 'header')!
			.lines.find((l) => l.id === 'moves')!;
		expect(moves.value).toContain('Shrug off a blow.');
		expect(light.sections.find((s) => s.id === 'offence')!.lines[0].value).toMatch(/\d-harm/);
		expect(light.tracker.hpMax).toBeGreaterThanOrEqual(4);
	});

	it('lists the generic adapter first for every preset', () => {
		for (const preset of PRESETS.presets) {
			const ids = adapterChoices(preset.id).map((a) => a.id);
			expect(ids[0]).toBe('generic');
			expect(ids).toContain('d20');
			expect(ids).toContain('osr');
			expect(ids).toContain('narrative');
			expect(ids).toContain('stat-light');
		}
	});
});

describe('applyOverrides', () => {
	const d20 = BUILT_IN_ADAPTERS.find((a) => a.id === 'd20')!;
	const npc = generateNpc(
		newRecipe({ tier: 2, preset: 'high-fantasy', seed: 'AAAAAAAA' }),
		catalogFor('high-fantasy')
	).value;
	const block = renderAdapter(d20, npc);

	it('replaces values, marks the lines and moves the hit point maximum', () => {
		const out = applyOverrides(block, { hp: '31', ac: '18 (plate)' });
		const lines = out.sections.flatMap((s) => s.lines);
		expect(lines.find((l) => l.id === 'hp')).toMatchObject({ value: '31', overridden: true });
		expect(lines.find((l) => l.id === 'ac')).toMatchObject({
			value: '18 (plate)',
			overridden: true
		});
		expect(lines.find((l) => l.id === 'cr')!.overridden).toBeUndefined();
		expect(out.tracker.hpMax).toBe(31);
		expect(block.tracker.hpMax).not.toBe(31);
	});

	it('keeps the maximum when the hit point override is not a number', () => {
		expect(applyOverrides(block, { hp: 'lots' }).tracker.hpMax).toBe(block.tracker.hpMax);
		expect(applyOverrides(block, {})).toBe(block);
	});

	it('prunes overrides of lines the block does not have', () => {
		expect(pruneOverrides(block, { hp: '1', gone: '2' })).toEqual({ hp: '1' });
	});
});
