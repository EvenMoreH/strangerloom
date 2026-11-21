import { describe, expect, it } from 'vitest';
import { catalogFor } from '../../content';
import { generateNpc } from '../npc';
import { newRecipe } from '../recipe';
import { AdapterPack, COMPETENCY_WORDS } from '../schema';
import { AdapterError, renderAdapter, renderGeneric } from './index';

const catalog = catalogFor('high-fantasy');
const npcFor = (seed: string, power = 5, archetype = 'any') =>
	generateNpc(
		{
			...newRecipe({ tier: 2, preset: 'high-fantasy', seed }),
			options: { ...newRecipe({ tier: 2, preset: 'high-fantasy', seed }).options, power, archetype }
		},
		catalog
	).value;

const pack = AdapterPack.parse({
	format: 'strangerloom-adapter',
	schemaVersion: 1,
	id: 'test-d20',
	name: 'Test d20',
	version: 2,
	labels: { hp: 'Hit Points', ac: 'Armor Class', defence: 'Defenses' },
	lookups: {
		hp: {
			by: ['threat', 'power'],
			rows: {
				minion: [3, 5, 7, 9, 11, 13, 15, 17, 19, 21],
				standard: [9, 15, 22, 30, 39, 48, 58, 68, 80, 92],
				elite: [20, 30, 45, 60, 75, 90, 110, 130, 150, 170],
				boss: [40, 60, 90, 120, 150, 180, 220, 260, 300, 340]
			}
		},
		hpDice: {
			by: ['threat'],
			rows: { minion: '1d8', standard: '4d8+4', elite: '9d10+18', boss: '15d12+45' }
		},
		damage: {
			by: ['damageClass', 'power'],
			rows: {
				light: [
					'1d4',
					'1d4',
					'1d4+1',
					'1d4+2',
					'1d6+2',
					'1d6+3',
					'2d4+3',
					'2d4+4',
					'2d6+4',
					'2d6+5'
				],
				medium: [
					'1d6',
					'1d6+1',
					'1d8+1',
					'1d8+2',
					'1d8+3',
					'1d10+3',
					'2d6+3',
					'2d6+4',
					'2d8+4',
					'2d8+5'
				],
				heavy: [
					'1d8',
					'1d8+1',
					'1d10+2',
					'1d10+3',
					'1d12+3',
					'2d6+4',
					'2d8+4',
					'2d8+5',
					'2d10+5',
					'2d10+6'
				]
			}
		}
	},
	fields: [
		{ id: 'cr', label: 'Challenge', formula: "threat == 'minion' ? '1/4' : str(power)" },
		{
			id: 'hp',
			section: 'defence',
			formula: "lookup('hp', threat, power)",
			roll: "lookup('hpDice', threat)"
		},
		{
			id: 'ac',
			section: 'defence',
			formula:
				"10 + floor(power / 2) + (defence == 'hard-to-hit' ? 2 : 0) + (has('armoured') ? 2 : 0)"
		},
		{
			id: 'attack',
			section: 'offence',
			formula: '2 + floor(power * 0.6)',
			format: '{signed(value)}',
			hidden: true
		},
		{ id: 'prof', formula: '2 + floor(power / 4)', hidden: true },
		{
			id: 'saves',
			section: 'defence',
			formula: "'Str ' + signed(prof)",
			note: 'Proficiency {prof}'
		}
	],
	attack: { toHit: '{signed(attack)}', damage: "{lookup('damage', damageClass, power)}" },
	competencies: {
		scale: [0, 2, 4, 6, 8, 10],
		label: 'Skills',
		format: '{signed(value)}',
		skills: { social: ['Deception', 'Persuasion'] }
	},
	abilities: { 'shield-wall': { name: 'Protection', text: 'Replaced text.' } },
	sections: ['header', 'defence', 'offence', 'competencies', 'abilities', 'gear', 'tactics'],
	subtitle: '{archetypeLabel} | CR {cr}',
	tracker: {
		hp: 'hp',
		hpRoll: 'hp',
		conditions: ['prone', 'grappled'],
		initiative: "'1d20' + signed(floor(power / 3))"
	}
});

describe('renderAdapter', () => {
	const npc = npcFor('7KQ2M9XA', 5, 'guard');
	const block = renderAdapter(pack, npc);

	it('fills the header and labels from the pack', () => {
		expect(block.adapter).toBe('test-d20');
		expect(block.adapterVersion).toBe(2);
		expect(block.title).toBe(npc.narrative.name.full);
		expect(block.subtitle).toBe(`${npc.profile!.archetypeLabel} | CR 5`);
		const header = block.sections.find((s) => s.id === 'header')!;
		expect(header.lines[0]).toEqual({ id: 'cr', label: 'Challenge', value: '5' });
	});

	it('evaluates lookups, has() and roll strings', () => {
		const defence = block.sections.find((s) => s.id === 'defence')!;
		expect(defence.label).toBe('Defenses');
		const hp = defence.lines.find((l) => l.id === 'hp')!;
		expect(hp).toEqual({ id: 'hp', label: 'Hit Points', value: '39', roll: '4d8+4' });
		const p = npc.profile!;
		const expectedAc =
			10 + 2 + (p.defence === 'hard-to-hit' ? 2 : 0) + (p.tags.includes('armoured') ? 2 : 0);
		expect(defence.lines.find((l) => l.id === 'ac')).toEqual({
			id: 'ac',
			label: 'Armor Class',
			value: String(expectedAc)
		});
		expect(defence.lines.find((l) => l.id === 'saves')).toEqual({
			id: 'saves',
			label: 'Saves',
			value: 'Str +3',
			note: 'Proficiency 3'
		});
	});

	it('hides hidden fields but lets later formulas read them', () => {
		expect(block.sections.flatMap((s) => s.lines).some((l) => l.id === 'attack')).toBe(false);
		expect(block.sections.flatMap((s) => s.lines).some((l) => l.id === 'prof')).toBe(false);
	});

	it('renders attacks with to-hit, damage dice and a roll', () => {
		const offence = block.sections.find((s) => s.id === 'offence')!;
		const attacks = offence.lines;
		expect(attacks.length).toBe(npc.profile!.attacks.length);
		for (const [i, a] of npc.profile!.attacks.entries()) {
			expect(attacks[i].label).toBe(a.name);
			expect(attacks[i].value).toMatch(
				/^(Melee|Ranged|Area), (close|near|far)\. \+5 to hit, \d+d\d+(\+\d+)?(, [a-z]+)? damage\.$/
			);
			expect(attacks[i].group).toBe(a.use === 'basic' ? 'At will' : 'Signature');
			expect(attacks[i].roll).toMatch(/^\d+d\d+/);
		}
	});

	it('maps competencies through the scale', () => {
		const comp = block.sections.find((s) => s.id === 'competencies')!;
		expect(comp.label).toBe('Skills');
		expect(comp.lines.length).toBe(6);
		expect(comp.lines[0].label).toBe('Combat');
		expect(comp.lines[0].value).toBe(`+${npc.profile!.competencies.combat * 2}`);
		expect(comp.lines[0].note).toBeUndefined();
		expect(comp.lines.find((l) => l.id === 'social')!.note).toBe('Deception, Persuasion');
	});

	it('competency formats can read the rating word and scale by power', () => {
		const block = renderAdapter(
			AdapterPack.parse({
				...pack,
				competencies: { format: "{word} ({signed(lookup('skill', rating, power))})" },
				lookups: {
					...pack.lookups,
					skill: {
						by: ['rating', 'power'],
						base: 0,
						rows: [
							[1, 2, 3],
							[4, 5, 6],
							[7, 8, 9],
							[10, 11, 12],
							[13, 14, 15],
							[16, 17, 18]
						]
					}
				}
			}),
			npc
		);
		const comp = block.sections.find((s) => s.id === 'competencies')!;
		const rating = npc.profile!.competencies.combat;
		const expected = rating * 3 + 1 + Math.min(2, npc.profile!.power);
		expect(comp.lines[0].value).toBe(`${COMPETENCY_WORDS[rating]} (+${expected})`);
	});

	it('replaces named abilities and copies gear and tactics', () => {
		const abilities = block.sections.find((s) => s.id === 'abilities')!;
		expect(abilities.lines.length).toBe(npc.profile!.abilities.length);
		const replaced = abilities.lines.find((l) => l.id === 'shield-wall');
		if (replaced) expect(replaced).toMatchObject({ label: 'Protection', note: 'Replaced text.' });
		const gear = block.sections.find((s) => s.id === 'gear')!;
		expect(gear.lines[0].value).toBe(npc.profile!.gear.join(', '));
		expect(block.sections.find((s) => s.id === 'tactics')!.lines[0].value).toMatch(/^[A-Z]/);
	});

	it('fills the tracker hint', () => {
		expect(block.tracker).toEqual({
			hpMax: 39,
			hpLine: 'hp',
			hpRoll: '4d8+4',
			conditions: ['prone', 'grappled'],
			initiative: '1d20+1'
		});
	});

	it('keeps the section order of the pack', () => {
		expect(block.sections.map((s) => s.id)).toEqual([
			'header',
			'defence',
			'offence',
			'competencies',
			'abilities',
			'gear',
			'tactics'
		]);
	});

	it('is deterministic across power levels and seeds', () => {
		for (const seed of ['AAAAAAAA', 'ZZZZZZZZ', '01234567']) {
			for (const power of [1, 4, 8, 10]) {
				const n = npcFor(seed, power);
				expect(renderAdapter(pack, n)).toEqual(renderAdapter(pack, n));
			}
		}
	});

	it('reports bad formulas with the field name', () => {
		const bad = { ...pack, fields: [{ id: 'x', formula: 'nope + 1' }] };
		expect(() => renderAdapter(bad, npc)).toThrow(AdapterError);
		expect(() => renderAdapter(bad, npc)).toThrow(/field "x".*Unknown name "nope"/);
		const badLookup = { ...pack, fields: [{ id: 'x', formula: "lookup('hp', threat)" }] };
		expect(() => renderAdapter(badLookup, npc)).toThrow(/takes 2 keys/);
		const missingRow = { ...pack, fields: [{ id: 'x', formula: "lookup('hpDice', 'dragon')" }] };
		expect(() => renderAdapter(missingRow, npc)).toThrow(/no row "dragon"/);
		const badRoll = { ...pack, fields: [{ id: 'x', formula: '1', roll: "'banana'" }] };
		expect(() => renderAdapter(badRoll, npc)).toThrow(/not a dice expression/);
		const badHp = { ...pack, tracker: { hp: 'cr' } };
		expect(() => renderAdapter(badHp, npc)).toThrow(/not a number/);
	});

	it('clamps array lookups to the row', () => {
		const clamped = {
			...pack,
			attack: {},
			subtitle: undefined,
			tracker: {},
			sections: ['header'],
			fields: [
				{ id: 'x', formula: "lookup('hp', 'minion', 99)" },
				{ id: 'y', formula: "lookup('hp', 'minion', 0)" }
			]
		};
		const lines = renderAdapter(clamped, npc).sections[0].lines;
		expect(lines.slice(0, 2).map((l) => l.value)).toEqual(['21', '3']);
	});

	it('refuses an NPC without a profile', () => {
		const flavour = generateNpc(
			newRecipe({ tier: 1, preset: 'high-fantasy', seed: 'AAAAAAAA' }),
			catalog
		).value;
		expect(() => renderAdapter(pack, flavour)).toThrow(/no profile/);
	});
});

describe('AdapterPack schema', () => {
	it('accepts the test pack and fills defaults', () => {
		expect(pack.template).toBe('full');
		expect(pack.labels.hp).toBe('Hit Points');
	});

	it('rejects bad ids and shapes', () => {
		const base = {
			format: 'strangerloom-adapter',
			schemaVersion: 1,
			id: 'x',
			name: 'X',
			version: 1,
			sections: ['header']
		};
		expect(AdapterPack.safeParse(base).success).toBe(true);
		expect(AdapterPack.safeParse({ ...base, id: 'Bad Id' }).success).toBe(false);
		expect(AdapterPack.safeParse({ ...base, sections: [] }).success).toBe(false);
		expect(AdapterPack.safeParse({ ...base, fields: [{ id: '1x', formula: '1' }] }).success).toBe(
			false
		);
		expect(AdapterPack.safeParse({ ...base, fields: [{ id: 'x' }] }).success).toBe(false);
		expect(AdapterPack.safeParse({ ...base, competencies: { scale: [1, 2] } }).success).toBe(false);
		expect(AdapterPack.safeParse({ ...base, format: 'strangerloom-tables' }).success).toBe(false);
	});
});

describe('renderGeneric tracker hint', () => {
	it('offers the generic condition list and no hit points', () => {
		const block = renderGeneric(npcFor('7KQ2M9XA'));
		expect(block.tracker.hpMax).toBeUndefined();
		expect(block.tracker.conditions).toContain('prone');
	});
});
