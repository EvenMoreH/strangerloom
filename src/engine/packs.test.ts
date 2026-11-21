import { describe, expect, it } from 'vitest';
import { adapterById, BUILT_IN_PACKS, catalogFor } from '../content';
import { buildBackup, parseImport } from './export';
import { generateNpc } from './npc';
import {
	checkAdapterPack,
	checkTablePack,
	cloneAdapter,
	compactEntry,
	conditionToText,
	mergedEntries,
	newTablePack,
	packKindOf,
	textToCondition,
	withoutTable,
	withTable
} from './packs';
import { newRecipe } from './recipe';
import { TableSet } from './tables';

const catalog = catalogFor('high-fantasy');
const samples = ['7KQ2M9XA', 'AAAAAAAA'].map(
	(seed) => generateNpc(newRecipe({ tier: 2, preset: 'high-fantasy', seed }), catalog).value
);

describe('replacing tables', () => {
	it('a replacing table stands in for the merged entries; an ordinary one adds to them', () => {
		const user = withTable(newTablePack('mine', 'Mine'), 'occupation', {
			entries: ['Test occupation'],
			replace: true
		});
		const replaced = new TableSet([...BUILT_IN_PACKS, user]);
		expect(replaced.table('occupation').entries.map((e) => e.v)).toEqual(['Test occupation']);
		const added = new TableSet([
			...BUILT_IN_PACKS,
			withTable(newTablePack('mine', 'Mine'), 'occupation', { entries: ['Extra'] })
		]);
		expect(added.table('occupation').entries.length).toBeGreaterThan(1);
		expect(added.table('occupation').entries.at(-1)?.v).toBe('Extra');
	});

	it('generation draws from the replaced table only', () => {
		const user = withTable(newTablePack('mine', 'Mine'), 'occupation', {
			entries: ['Test occupation'],
			replace: true
		});
		const cat = catalogFor('high-fantasy', [user]);
		for (const seed of ['7KQ2M9XA', 'ZZZZZZZZ']) {
			const npc = generateNpc(newRecipe({ tier: 1, preset: 'high-fantasy', seed }), cat).value;
			expect(npc.narrative.occupation).toBe('Test occupation');
		}
	});

	it('withTable and withoutTable move the version on', () => {
		const a = withTable(newTablePack('mine', 'Mine'), 't', { entries: ['x'] });
		expect(a.version).toBe(2);
		expect(withoutTable(a, 't').tables).toEqual({});
		expect(withoutTable(a, 't').version).toBe(3);
	});
});

describe('checkTablePack', () => {
	it('accepts a pack whose tokens resolve against the built-ins', () => {
		const pack = withTable(newTablePack('mine', 'Mine'), 'occupation', {
			entries: ['{occupation} of the {place}']
		});
		expect(checkTablePack(pack, BUILT_IN_PACKS).errors).toEqual([]);
	});

	it('reports schema errors, built-in ids, unknown tables and variables', () => {
		expect(checkTablePack({ format: 'nope' }, BUILT_IN_PACKS).errors[0]).toMatch(/format/);
		expect(checkTablePack(newTablePack('core', 'Core'), BUILT_IN_PACKS).errors[0]).toMatch(
			/built-in/
		);
		const bad = withTable(newTablePack('mine', 'Mine'), 'thing', {
			entries: ['{nothing.here}', { v: '{names.$nope}', w: 2 }]
		});
		const { errors } = checkTablePack(bad, BUILT_IN_PACKS);
		expect(errors).toContain('thing entry 1: unknown table {nothing.here}.');
		expect(errors).toContain('thing entry 2: unknown variable $nope in {names.$nope}.');
	});
});

describe('checkAdapterPack', () => {
	it('accepts the built-in d20 adapter and a clone of it', () => {
		const d20 = adapterById('d20')!;
		expect(checkAdapterPack(d20, samples).errors).toEqual([]);
		const clone = cloneAdapter(d20, 'my-d20', 'My d20');
		expect(clone.id).toBe('my-d20');
		expect(clone.version).toBe(1);
		expect(checkAdapterPack(clone, samples).errors).toEqual([]);
		expect(d20.id).toBe('d20');
	});

	it('reports formula errors from a render', () => {
		const d20 = adapterById('d20')!;
		const broken = {
			...d20,
			fields: [...d20.fields, { id: 'x', formula: 'lookup("missing", 1)' }]
		};
		const { errors } = checkAdapterPack(broken, samples);
		expect(errors.length).toBe(1);
		expect(errors[0]).toMatch(/missing|lookup/);
	});
});

describe('entries and conditions', () => {
	it('round-trips a condition through text', () => {
		const when = { preset: ['high-fantasy', 'grimdark'], gender: ['f'] };
		const text = conditionToText(when);
		expect(text).toBe('preset: high-fantasy, grimdark; gender: f');
		expect(textToCondition(text).when).toEqual(when);
		expect(textToCondition('').when).toBeUndefined();
		expect(textToCondition('colour: red').error).toMatch(/not a condition key/);
		expect(textToCondition('preset').error).toMatch(/form/);
	});

	it('compacts entries and copies merged entries', () => {
		expect(compactEntry({ v: 'Plain' })).toBe('Plain');
		expect(compactEntry({ v: 'Plain', w: 1 })).toBe('Plain');
		expect(compactEntry({ v: 'Rare', w: 0.5, tags: ['x'] })).toEqual({
			v: 'Rare',
			w: 0.5,
			tags: ['x']
		});
		const copy = mergedEntries(catalog, 'occupation');
		expect(copy.length).toBeGreaterThan(10);
		expect(mergedEntries(catalog, 'nothing')).toEqual([]);
	});
});

describe('pack files in import', () => {
	it('reads a table pack file and an adapter file into user packs', () => {
		const pack = withTable(newTablePack('mine', 'Mine'), 'occupation', { entries: ['Extra'] });
		const one = parseImport(JSON.parse(JSON.stringify(pack)));
		expect(one.packs).toHaveLength(1);
		expect(one.packs[0].kind).toBe('tables');
		expect(one.packs[0].enabled).toBe(true);
		const two = parseImport(JSON.parse(JSON.stringify(adapterById('osr'))));
		expect(two.packs[0].kind).toBe('adapter');
		expect(packKindOf(pack)).toBe('tables');
		expect(packKindOf({})).toBeNull();
	});
});

describe('packs in a backup', () => {
	it('round-trips user packs through the backup file', () => {
		const pack = withTable(newTablePack('mine', 'Mine'), 'occupation', { entries: ['Extra'] });
		const user = parseImport(JSON.parse(JSON.stringify(pack))).packs;
		const backup = buildBackup([], [], {}, user);
		const back = parseImport(JSON.parse(JSON.stringify(backup)));
		expect(back.packs).toEqual(user);
		expect(back.packs[0].pack.id).toBe('mine');
	});
});
