// Template expansion: `{table.key}` tokens draw from tables, `$var` inside a token reads the context, phonetic
// tables re-roll until the syllables read as a word.
import { pickWeighted, type Rng } from './rng';
import type { EntryObject } from './schema';
import { weightOf, type GenContext, type TableSet } from './tables';

const TOKEN = /\{([^{}]+)\}/g;
const VARIABLE = /\$(\w+)/g;
const MAX_DEPTH = 12;
const PHONETIC_TRIES = 80;
const PART_TRIES = 30;

const BLOCKED = [
	'anal',
	'anus',
	'chink',
	'cock',
	'coon',
	'cum',
	'cunt',
	'dick',
	'dyke',
	'fag',
	'fuck',
	'gook',
	'jizz',
	'kike',
	'kkk',
	'nazi',
	'negr',
	'nig',
	'piss',
	'poo',
	'porn',
	'rape',
	'semen',
	'sex',
	'shit',
	'slut',
	'spic',
	'tit',
	'twat',
	'wank',
	'whore',
	'dildo',
	'milf',
	'boob',
	'pube',
	'turd',
	'crap'
];

// Syllable results that read as a well-known character rather than a new one.
const FAMOUS = new Set([
	'aragorn',
	'arwen',
	'arthas',
	'balin',
	'beren',
	'bilbo',
	'celeborn',
	'drizzt',
	'durin',
	'dwalin',
	'elminster',
	'elrond',
	'feanor',
	'frodo',
	'galadriel',
	'gandalf',
	'geralt',
	'gimli',
	'gloin',
	'glorfindel',
	'gollum',
	'haldir',
	'illidan',
	'jaina',
	'legolas',
	'luthien',
	'malfurion',
	'raistlin',
	'sauron',
	'smaug',
	'sylvanas',
	'tauriel',
	'thorin',
	'thrall',
	'thranduil',
	'tiamat',
	'tyrande',
	'yennefer',
	'merry',
	'pippin',
	'samwise',
	'meriadoc',
	'peregrin',
	'lobelia',
	'gimble',
	'dimble',
	'zook',
	'boddynock',
	'nissa',
	'mammon',
	'zariel',
	'belial',
	'azazel',
	'lilith',
	'asmodeus',
	'mephisto',
	'lucifer',
	'baal',
	'levistus',
	'glasya',
	'damakos',
	'nemeia',
	'damaia',
	'akmenos'
]);

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Pronounceability rules for syllable-generated words. */
export function isPronounceable(word: string, { min = 3, max = 12 } = {}): boolean {
	const letters = stripAccents(word)
		.toLowerCase()
		.replace(/[^a-z]/g, '');
	if (letters.length < min || letters.length > max) return false;
	if (FAMOUS.has(letters)) return false;
	if (BLOCKED.some((bad) => letters.includes(bad))) return false;
	const shape = letters
		.replace(/th|sh|ch|ph|kh|gh|zh/g, 'q')
		.replace(/y(?=[aeiou])/g, 'j')
		.replace(/y/g, 'i');
	if (/(.)\1\1/.test(shape)) return false;
	if (/aa|ii|uu/.test(shape)) return false;
	if (/[aeiou]{3}/.test(shape)) return false;
	if (/[^aeiou]{4}/.test(shape)) return false;
	if (/[^aeiou]{3}$/.test(shape)) return false;
	if (/(.{2,})\1/.test(shape)) return false;
	return true;
}

/** A finished part has no unexpanded token and no 4+ letter chunk repeated inside it. */
export function isWellFormed(part: string): boolean {
	if (!part || /[{}$]/.test(part)) return false;
	return !/(.{4,}).*\1/.test(part.toLowerCase());
}

export class TemplateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TemplateError';
	}
}

export interface ExpandState {
	/** Variables the expansion read. */
	used: Set<string>;
	/** A neutral gender request fell back to the binary form because the table had no neutral list. */
	genderFallback: boolean;
	/** A phonetic table ran out of tries; the last candidate was used. */
	exhausted: boolean;
}

export const newExpandState = (): ExpandState => ({
	used: new Set(),
	genderFallback: false,
	exhausted: false
});

const VARIABLES: Record<string, (ctx: GenContext) => string | undefined> = {
	g: (c) => c.gender,
	sex: (c) => c.sex,
	culture: (c) => c.culture,
	alt: (c) => c.alt,
	ancestry: (c) => c.ancestry,
	archetype: (c) => c.archetype
};

export class Expander {
	constructor(
		private tables: TableSet,
		private ctx: GenContext,
		private rng: Rng,
		readonly state: ExpandState = newExpandState()
	) {}

	private substitute(rawKey: string, overrides: Record<string, string> = {}): string {
		return rawKey.replace(VARIABLE, (_, name: string) => {
			const value = overrides[name] ?? VARIABLES[name]?.(this.ctx);
			if (value === undefined) throw new TemplateError(`Unknown variable $${name} in {${rawKey}}.`);
			this.state.used.add(name);
			return value;
		});
	}

	private resolveKey(rawKey: string): string {
		const key = this.substitute(rawKey);
		if (this.tables.has(key)) return key;
		if (this.ctx.gender === 'n' && this.ctx.sex && rawKey.includes('$g')) {
			const fallback = this.substitute(rawKey, { g: this.ctx.sex });
			if (this.tables.has(fallback)) {
				this.state.genderFallback = true;
				return fallback;
			}
		}
		throw new TemplateError(`Unknown table "${key}" (from {${rawKey}}).`);
	}

	private draw(entries: EntryObject[], id: string): EntryObject {
		if (entries.length === 0)
			throw new TemplateError(`Table "${id}" has no entry for this context.`);
		return pickWeighted(this.rng, entries, weightOf);
	}

	private expandTable(rawKey: string, depth: number): string {
		const id = this.resolveKey(rawKey);
		const table = this.tables.table(id);
		const entries = this.tables.entries(id, this.ctx);
		if (!table.phonetic) return this.expand(this.draw(entries, id).v, depth + 1);
		let candidate = '';
		for (let i = 0; i < PHONETIC_TRIES; i++) {
			candidate = this.expand(this.draw(entries, id).v, depth + 1);
			if (isPronounceable(candidate, table)) return candidate;
		}
		this.state.exhausted = true;
		return candidate;
	}

	/** Expands every token in a template. */
	expand(template: string, depth = 0): string {
		if (depth > MAX_DEPTH) throw new TemplateError(`Template nesting too deep: ${template}`);
		return template.replace(TOKEN, (_, key: string) => this.expandTable(key, depth));
	}

	/** Draws one entry from a list and expands it, retrying until the result is well formed. */
	part(entries: EntryObject[], id = 'inline'): { value: string; entry: EntryObject } {
		let value = '';
		let entry = entries[0];
		for (let i = 0; i < PART_TRIES; i++) {
			entry = this.draw(entries, id);
			value = this.expand(entry.v).replace(/\s+/g, ' ').trim();
			if (isWellFormed(value)) return { value, entry };
		}
		return { value, entry };
	}

	/** Draws from a table by id. */
	fromTable(id: string): { value: string; entry: EntryObject } {
		return this.part(this.tables.entries(id, this.ctx), id);
	}
}
