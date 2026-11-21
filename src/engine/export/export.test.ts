import { describe, expect, it } from 'vitest';
import { adapterById, catalogFor } from '../../content';
import { renderAdapter, renderGeneric } from '../adapter';
import { fieldText } from '../narrative';
import { generateNpc } from '../npc';
import { generateParty } from '../party';
import { newRecipe } from '../recipe';
import type { Npc, SavedNpc, SavedParty } from '../schema';
import {
	chronicleMarkdown,
	buildBackup,
	ImportError,
	matches,
	npcMarkdown,
	npcSearchText,
	parseImport,
	partyMarkdown,
	partySearchText,
	remapIds,
	tallyhoText,
	blurbOf,
	narrativeRows,
	type TextOptions
} from './index';

const catalog = catalogFor('high-fantasy');
const npc = generateNpc(
	newRecipe({ tier: 2, preset: 'high-fantasy', seed: '7KQ2M9XA' }),
	catalog
).value;
const text = (n: Npc): TextOptions => ({ text: (f) => fieldText(n.narrative, f) });
const blockFor = (n: Npc, adapter: string) =>
	adapter === 'generic' ? renderGeneric(n) : renderAdapter(adapterById(adapter)!, n, {});

const saved = (n: Npc, id = 'a'): SavedNpc => ({
	id,
	createdAt: '2026-10-31T10:00:00.000Z',
	updatedAt: '2026-10-31T10:00:00.000Z',
	recipe: newRecipe({ tier: 2, preset: 'high-fantasy', seed: '7KQ2M9XA' }),
	npc: n,
	favourite: false,
	tags: ['tavern', 'Act 1'],
	notes: 'owes the party a favour',
	chronicle: [
		{
			id: 'c1',
			at: '2026-10-31T20:00:00.000Z',
			label: 'Session 4',
			text: 'Met the party at the gate.'
		}
	],
	overrides: {}
});

describe('chronicle', () => {
	it('is searchable and exported as a Markdown section, newest first', () => {
		expect(matches(npcSearchText(saved(npc)), 'gate session')).toBe(true);
		const md = chronicleMarkdown([
			...saved(npc).chronicle,
			{ id: 'c2', at: '2026-11-01T10:00:00.000Z', label: '', text: 'Left town.' }
		]);
		expect(md).toContain('## Chronicle');
		expect(md.indexOf('Left town.')).toBeLessThan(md.indexOf('Met the party'));
		expect(md).toContain('- **2026-10-31, Session 4.** Met the party at the gate.');
		expect(chronicleMarkdown([])).toBe('');
	});
});

describe('markdown', () => {
	it('writes the NPC with its rows and stat block sections', () => {
		const md = npcMarkdown(npc, blockFor(npc, 'd20'), text(npc), { seed: '7KQ2-M9XA' });
		expect(md.startsWith('# ' + npc.narrative.name.full)).toBe(true);
		expect(md).toContain('- **Quirk:** ' + npc.narrative.quirk);
		for (const s of blockFor(npc, 'd20').sections) expect(md).toContain('## ' + s.label);
		expect(md).toMatch(/`1?d\d+/);
		expect(md.trimEnd().endsWith('Seed: 7KQ2-M9XA')).toBe(true);
	});

	it('writes a party with every member under its own heading, leader first', () => {
		const recipe = newRecipe({ tier: 3, preset: 'modern', seed: 'AAAAAAAA' });
		const party = generateParty(recipe, catalogFor('modern')).value;
		const md = partyMarkdown(party, {
			member: (i) => text(party.members[i]),
			blocks: party.members.map(() => null),
			order: [
				party.leaderIndex,
				...party.members.map((_, i) => i).filter((i) => i !== party.leaderIndex)
			],
			averagePower: 5
		});
		expect(md.startsWith('# ' + party.name)).toBe(true);
		expect(md.match(/^### /gm)).toHaveLength(party.members.length);
		expect(
			md.indexOf(party.members[party.leaderIndex].narrative.name.full + ' (leader)')
		).toBeLessThan(md.indexOf('### ', md.indexOf('## Members') + 12) + 200);
		expect(md).toContain('## Relationships');
	});
});

describe('tallyhoText', () => {
	it('starts with the person, then after a blank line the stat block with Actions and Traits', () => {
		for (const adapter of ['generic', 'd20', 'osr', 'narrative', 'stat-light']) {
			const t = tallyhoText(npc, blockFor(npc, adapter), text(npc));
			const lines = t.trimEnd().split('\n');
			expect(lines[0]).toBe(npc.narrative.name.full);
			expect(lines[1]).toBe(blurbOf(npc.narrative, text(npc)));
			const [person, stats] = t.split('\n\n');
			expect(person.split('\n').some((l) => l.startsWith('Quirk: '))).toBe(true);
			expect(person).not.toContain('Actions');
			expect(stats.split('\n')).toContain('Actions');
			expect(stats.split('\n')).toContain('Traits');
			expect(stats.split('\n').some((l) => l.startsWith('Skills '))).toBe(true);
			expect(t.split('\n\n')).toHaveLength(2);
		}
		const d20 = tallyhoText(npc, blockFor(npc, 'd20'), text(npc)).split('\n');
		expect(d20.some((l) => /^Armor Class \d+/.test(l))).toBe(true);
		expect(d20.some((l) => /^Hit Points \d+/.test(l))).toBe(true);
		expect(d20.some((l) => /^Challenge /.test(l))).toBe(true);
		expect(
			d20.some((l) =>
				/^[^.]+\. (Melee|Ranged) Weapon Attack: \+\d+ to hit, \w+\. Hit: \d*d\d+(\+\d+)? (\w+ )?damage\./.test(
					l
				)
			)
		).toBe(true);
	});

	it('writes a flavour NPC as the person alone, hidden fields left out', () => {
		const t = tallyhoText(npc, null, { ...text(npc), hidden: (f) => f === 'secret' });
		expect(t).not.toContain('Secret:');
		expect(t).toContain('\nQuirk: ');
		expect(t).not.toContain('\n\n');
		expect(t.trimEnd().split('\n')).toHaveLength(2 + narrativeRows(text(npc)).length - 1);
	});
});

describe('backup and import', () => {
	const party = generateParty(
		newRecipe({ tier: 3, preset: 'sci-fi', seed: 'ZZZZZZZZ' }),
		catalogFor('sci-fi')
	).value;
	const savedParty: SavedParty = {
		id: 'p1',
		createdAt: '2026-10-31T10:00:00.000Z',
		updatedAt: '2026-10-31T10:00:00.000Z',
		recipe: newRecipe({ tier: 3, preset: 'sci-fi', seed: 'ZZZZZZZZ' }),
		favourite: true,
		tags: [],
		notes: '',
		chronicle: [],
		party
	};

	it('round-trips a backup through JSON', () => {
		const backup = buildBackup([saved(npc)], [savedParty], { theme: 'dark' });
		const back = parseImport(JSON.parse(JSON.stringify(backup)));
		expect(back.npcs).toEqual([saved(npc)]);
		expect(back.parties).toEqual([savedParty]);
		expect(back.prefs).toEqual({ theme: 'dark' });
	});

	it('accepts one record or a list of records', () => {
		expect(parseImport(JSON.parse(JSON.stringify(saved(npc)))).npcs).toHaveLength(1);
		const both = parseImport(JSON.parse(JSON.stringify([saved(npc), savedParty])));
		expect(both.npcs).toHaveLength(1);
		expect(both.parties).toHaveLength(1);
	});

	it('rejects foreign files and newer formats with a readable message', () => {
		expect(() => parseImport({ hello: 1 })).toThrow(ImportError);
		expect(() => parseImport('text')).toThrow(/not a Strangerloom export/);
		expect(() =>
			parseImport({ format: 'strangerloom-library', version: 9, exportedAt: '' })
		).toThrow(/version 9/);
		expect(() => parseImport({ npc: {}, id: 'x' })).toThrow(/NPC record/);
	});

	it('remaps colliding ids only', () => {
		let n = 0;
		const { items, remapped } = remapIds(
			[saved(npc, 'a'), saved(npc, 'b'), saved(npc, 'c')],
			new Set(['b']),
			() => 'new' + n++
		);
		expect(remapped).toBe(1);
		expect(items.map((i) => i.id)).toEqual(['a', 'new0', 'c']);
	});
});

describe('search', () => {
	it('finds records by name, tag, note, narrative line and archetype; every term must match', () => {
		const hay = npcSearchText(saved(npc));
		expect(matches(hay, npc.narrative.name.given)).toBe(true);
		expect(matches(hay, 'TAVERN act')).toBe(true);
		expect(matches(hay, 'favour')).toBe(true);
		expect(matches(hay, npc.narrative.quirk.split(' ')[0])).toBe(true);
		expect(matches(hay, npc.profile!.archetypeLabel.toLowerCase())).toBe(true);
		expect(matches(hay, 'tavern zzzzzz')).toBe(false);
		expect(matches(hay, '')).toBe(true);
	});

	it('searches parties by their fields and members', () => {
		const party = generateParty(
			newRecipe({ tier: 3, preset: 'high-fantasy', seed: 'HE110123' }),
			catalog
		).value;
		const hay = partySearchText({
			id: 'p',
			createdAt: '',
			updatedAt: '',
			recipe: newRecipe({ tier: 3, preset: 'high-fantasy', seed: 'HE110123' }),
			favourite: false,
			tags: [],
			notes: '',
			chronicle: [],
			party
		});
		expect(matches(hay, party.members[2].narrative.name.given)).toBe(true);
		expect(matches(hay, party.goal.split(' ').slice(0, 2).join(' '))).toBe(true);
	});
});
