import { describe, expect, it } from 'vitest';
import type { TablePack } from './schema';
import { matches, TableSet } from './tables';

const packA: TablePack = {
	format: 'strangerloom-tables',
	schemaVersion: 1,
	id: 'a',
	name: 'A',
	version: 2,
	tables: {
		colour: {
			shape: 'adjective',
			entries: ['red', { v: 'blue', w: 2 }, { v: 'black', when: { tone: ['dark'] } }]
		},
		'syl.x': { phonetic: true, max: 6, entries: ['{colour}'] }
	}
};
const packB: TablePack = {
	format: 'strangerloom-tables',
	schemaVersion: 1,
	id: 'b',
	name: 'B',
	version: 1,
	tables: { colour: { entries: ['green'] } }
};

describe('matches', () => {
	it('passes without a condition', () => {
		expect(matches(undefined, { preset: 'x' })).toBe(true);
	});
	it('needs every key to share a value with the context', () => {
		const ctx = { preset: 'high-fantasy', ancestry: 'elf', tone: ['light', 'neutral'] };
		expect(matches({ preset: ['high-fantasy'] }, ctx)).toBe(true);
		expect(matches({ preset: ['modern'] }, ctx)).toBe(false);
		expect(matches({ preset: ['high-fantasy'], ancestry: ['dwarf'] }, ctx)).toBe(false);
		expect(matches({ tone: ['dark'] }, ctx)).toBe(false);
		expect(matches({ tone: ['dark', 'neutral'] }, ctx)).toBe(true);
		expect(matches({ tier: ['2'] }, { ...ctx, tier: 2 })).toBe(true);
		expect(matches({ archetype: ['guard'] }, ctx)).toBe(false);
	});
});

describe('TableSet', () => {
	const set = new TableSet([packA, packB]);

	it('merges entries of the same table across packs and records versions', () => {
		expect(set.table('colour').entries.map((e) => e.v)).toEqual(['red', 'blue', 'black', 'green']);
		expect(set.versions).toEqual({ a: 2, b: 1 });
		expect(set.ids().sort()).toEqual(['colour', 'syl.x']);
	});

	it('keeps phonetic settings with defaults', () => {
		expect(set.table('syl.x')).toMatchObject({ phonetic: true, min: 3, max: 6 });
		expect(set.table('colour').phonetic).toBe(false);
	});

	it('keeps the shape across packs and lets a later pack change it', () => {
		expect(set.table('colour').shape).toBe('adjective');
		expect(set.table('syl.x').shape).toBeUndefined();
		const changed = new TableSet([
			packA,
			{ ...packB, tables: { colour: { shape: 'noun', replace: true, entries: ['a red thing'] } } }
		]);
		expect(changed.table('colour').shape).toBe('noun');
	});

	it('filters entries by context', () => {
		expect(set.entries('colour', { preset: 'p', tone: ['light'] }).map((e) => e.v)).toEqual([
			'red',
			'blue',
			'green'
		]);
		expect(set.entries('colour', { preset: 'p', tone: ['dark'] }).map((e) => e.v)).toContain(
			'black'
		);
	});

	it('throws for an unknown table', () => {
		expect(() => set.table('nothing')).toThrow('Unknown table "nothing"');
		expect(set.has('nothing')).toBe(false);
	});
});
