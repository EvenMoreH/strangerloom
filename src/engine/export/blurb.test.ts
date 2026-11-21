import { describe, expect, it } from 'vitest';
import type { Narrative, NarrativeField, Shape } from '../schema';
import { BUILT_IN_PACKS } from '../../content';
import { article, blurbOf, lookJoin } from './blurb';

const narrative: Narrative = {
	ancestry: 'human',
	gender: 'f',
	name: { given: 'Edith', family: 'Northgate', extra: '', full: 'Edith Northgate' },
	pronouns: 'she/her',
	age: { stage: 'middle-aged', years: 48 },
	occupation: 'Grave-warden',
	quirk: 'has a tremor in one hand',
	visual: 'a lute with one string missing',
	trait: 'cannot resist a wager',
	ideal: 'Family comes before everything.',
	bond: 'is the last of a family that once mattered',
	flaw: 'believes a prophecy about themselves',
	voice: 'never uses names, only descriptions',
	mood: 'amused',
	attitude: 'friendly',
	secret: 'has been stealing from their employer for years'
} as Narrative;

const labels: Partial<Record<NarrativeField, string>> = {
	ancestry: 'Human',
	age: 'middle-aged, 48 years'
};
const textOf = (n: Narrative) => (f: NarrativeField) => labels[f] ?? String(n[f] ?? '');
const text = textOf(narrative);
const opts = (
	hidden: NarrativeField[] = [],
	shapes: Partial<Record<NarrativeField, Shape>> = {},
	n: Narrative = narrative
) => ({
	text: textOf(n),
	hidden: (f: NarrativeField) => hidden.includes(f),
	shape: (f: NarrativeField) => shapes[f]
});

describe('article', () => {
	it('follows the sound', () => {
		expect(article('innkeeper')).toBe('an');
		expect(article('Union steward')).toBe('a');
		expect(article('hour-keeper')).toBe('an');
		expect(article('one-eyed fence')).toBe('a');
		expect(article('grave-warden')).toBe('a');
		expect(article('ex-corporate analyst')).toBe('an');
	});
});

describe('lookJoin', () => {
	it('wears garments, carries things and keeps "with" for body features', () => {
		expect(lookJoin('a scarf covering the lower face')).toBe('wearing');
		expect(lookJoin('spectacles with one cracked lens')).toBe('wearing');
		expect(lookJoin('a heavy brass key hanging from a cord around the neck')).toBe('wearing');
		expect(lookJoin('a lute with one string missing')).toBe('carrying');
		expect(lookJoin('a bike helmet clipped to a backpack')).toBe('carrying');
		expect(lookJoin('an eye that glows faintly blue')).toBe('with');
		expect(lookJoin('a pipe that is never lit')).toBe('with');
		expect(lookJoin('a holy symbol worn backwards')).toBe('with');
		expect(lookJoin('a dented helm carried under the arm')).toBe('with');
	});
	it('never doubles a word on any core look', () => {
		const core = BUILT_IN_PACKS.find((p) => p.id === 'core')!;
		for (const e of core.tables.visual.entries) {
			const look = typeof e === 'string' ? e : e.v;
			const line = `${lookJoin(look)} ${look}`;
			expect(line, look).not.toMatch(/\bwith\b.*\bwith\b/);
			expect(line, look).not.toMatch(/\bwearing\b.*\bw(orn|earing)\b/);
			expect(line, look).not.toMatch(/\bcarrying\b.*\bcarr(ied|ying)\b/);
		}
	});
});

describe('blurbOf', () => {
	it('reads as two sentences with the seven fields under the name', () => {
		expect(blurbOf(narrative, opts())).toBe(
			'Human, 48, a grave-warden carrying a lute with one string missing who has a tremor in one hand. Friendly towards people, amused at the moment.'
		);
	});
	it('says wearing or carrying before garments and things', () => {
		const glasses = { ...narrative, visual: 'spectacles with one cracked lens' };
		expect(blurbOf(glasses, opts([], {}, glasses))).toMatch(
			/a grave-warden wearing spectacles with one cracked lens who has a tremor/
		);
		const lute = { ...narrative, visual: 'a lute with one string missing' };
		expect(blurbOf(lute, opts([], {}, lute))).toMatch(
			/a grave-warden carrying a lute with one string missing who/
		);
		expect(blurbOf(lute, opts(['occupation'], {}, lute))).toMatch(
			/^Human, 48, has a lute with one string missing and/
		);
	});
	it('drops hidden fields with their connectives', () => {
		expect(blurbOf(narrative, opts(['occupation']))).toBe(
			'Human, 48, has a lute with one string missing and has a tremor in one hand. Friendly towards people, amused at the moment.'
		);
		expect(blurbOf(narrative, opts(['occupation', 'visual']))).toBe(
			'Human, 48, has a tremor in one hand. Friendly towards people, amused at the moment.'
		);
		expect(blurbOf(narrative, opts(['ancestry', 'age', 'attitude']))).toBe(
			'A grave-warden carrying a lute with one string missing who has a tremor in one hand. Amused at the moment.'
		);
		expect(blurbOf(narrative, opts(['occupation', 'visual', 'quirk', 'mood', 'attitude']))).toBe(
			'Human, 48.'
		);
	});
	it('is empty when every field is hidden', () => {
		const all: NarrativeField[] = [
			'ancestry',
			'age',
			'occupation',
			'visual',
			'quirk',
			'mood',
			'attitude'
		];
		expect(blurbOf(narrative, opts(all))).toBe('');
	});
	it('keeps the culture label after the ancestry', () => {
		expect(
			blurbOf(narrative, { ...opts(), text: (f) => (f === 'ancestry' ? 'Human, French' : text(f)) })
		).toMatch(/^Human, French, 48, a grave-warden/);
	});
	it('turns an entry of another shape into a sentence of its own', () => {
		const sentences = {
			...narrative,
			quirk: 'Nobody has seen them blink.',
			mood: 'hums old marching songs'
		};
		expect(blurbOf(sentences, opts([], { quirk: 'sentence', mood: 'verb' }, sentences))).toBe(
			'Human, 48, a grave-warden carrying a lute with one string missing. Nobody has seen them blink. Friendly towards people. Edith hums old marching songs.'
		);
		const noun = { ...narrative, quirk: 'a limp from an old wound' };
		expect(blurbOf(noun, opts([], { quirk: 'noun' }, noun))).toMatch(
			/carrying a lute with one string missing with a limp from an old wound\./
		);
		const adjective = { ...narrative, occupation: 'unemployed' };
		expect(blurbOf(adjective, opts([], { occupation: 'adjective' }, adjective))).toMatch(
			/48, unemployed carrying a lute with one string missing and has a tremor/
		);
	});
});
