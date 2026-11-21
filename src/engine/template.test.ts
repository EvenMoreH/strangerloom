import { describe, expect, it } from 'vitest';
import { stream } from './rng';
import type { TablePack } from './schema';
import { TableSet } from './tables';
import { Expander, isPronounceable, isWellFormed } from './template';

const pack: TablePack = {
	format: 'strangerloom-tables',
	schemaVersion: 1,
	id: 't',
	name: 'T',
	version: 1,
	tables: {
		start: { entries: ['Ael', 'Thar', 'Mor'] },
		'end.f': { entries: ['a', 'iel', 'wen'] },
		'end.m': { entries: ['on', 'ric', 'dur'] },
		'syl.f': { phonetic: true, max: 8, entries: ['{start}{end.f}'] },
		'syl.m': { phonetic: true, max: 8, entries: ['{start}{end.m}'] },
		given: { entries: ['{syl.$g}'] },
		'culture.polish.family.f': { entries: ['Kowalska'] },
		'culture.polish.family.m': { entries: ['Kowalski'] },
		family: { entries: ['{culture.$culture.family.$sex}'] },
		loop: { entries: ['{loop}'] },
		dark: { entries: [{ v: 'night', when: { tone: ['dark'] } }] }
	}
};
const tables = new TableSet([pack]);

describe('isPronounceable', () => {
	it('accepts plain words and rejects awkward shapes', () => {
		expect(isPronounceable('Aelwen')).toBe(true);
		expect(isPronounceable('Thardur')).toBe(true);
		expect(isPronounceable('Aaa')).toBe(false);
		expect(isPronounceable('Strngth')).toBe(false);
		expect(isPronounceable('Elel')).toBe(false);
		expect(isPronounceable('Ab')).toBe(false);
		expect(isPronounceable('Legolas')).toBe(false);
	});
	it('counts digraphs as one consonant', () => {
		expect(isPronounceable('Thrash')).toBe(true);
	});
});

describe('isWellFormed', () => {
	it('rejects leftovers and repeats', () => {
		expect(isWellFormed('Stonewood')).toBe(true);
		expect(isWellFormed('Stonestone')).toBe(false);
		expect(isWellFormed('{start}')).toBe(false);
		expect(isWellFormed('')).toBe(false);
	});
});

describe('Expander', () => {
	it('expands tokens with variables deterministically', () => {
		const a = new Expander(tables, { preset: 'p', gender: 'f', sex: 'f' }, stream('AAAAAAAA', 'x'));
		const b = new Expander(tables, { preset: 'p', gender: 'f', sex: 'f' }, stream('AAAAAAAA', 'x'));
		const first = a.expand('{given}');
		expect(first).toBe(b.expand('{given}'));
		expect(first).toMatch(/^(Ael|Thar|Mor)(a|iel|wen)$/);
		expect(a.state.used.has('g')).toBe(true);
	});

	it('uses gendered family forms through $culture and $sex', () => {
		const f = new Expander(
			tables,
			{ preset: 'p', gender: 'n', sex: 'f', culture: 'polish' },
			stream('A', 'x')
		);
		expect(f.expand('{family}')).toBe('Kowalska');
		const m = new Expander(
			tables,
			{ preset: 'p', gender: 'n', sex: 'm', culture: 'polish' },
			stream('A', 'x')
		);
		expect(m.expand('{family}')).toBe('Kowalski');
	});

	it('falls back from a missing neutral table to the binary form and records it', () => {
		const e = new Expander(tables, { preset: 'p', gender: 'n', sex: 'm' }, stream('A', 'x'));
		expect(e.expand('{given}')).toMatch(/(on|ric|dur)$/);
		expect(e.state.genderFallback).toBe(true);
	});

	it('reports unknown variables, tables, empty filters and deep nesting', () => {
		const e = new Expander(tables, { preset: 'p' }, stream('A', 'x'));
		expect(() => e.expand('{syl.$g}')).toThrow('Unknown variable $g');
		expect(() => e.expand('{nothing}')).toThrow('Unknown table "nothing"');
		expect(() => e.expand('{loop}')).toThrow('too deep');
		expect(() => e.fromTable('dark')).toThrow('no entry for this context');
	});

	it('part retries until the value is well formed', () => {
		const e = new Expander(tables, { preset: 'p', tone: ['dark'] }, stream('A', 'x'));
		expect(e.fromTable('dark')).toEqual({
			value: 'night',
			entry: { v: 'night', when: { tone: ['dark'] } }
		});
	});
});
