// Table packs merged into one lookup, and the condition filter that decides which entries a context may draw.
import type {
	Condition,
	ConditionKey,
	Entry,
	EntryObject,
	Shape,
	Table,
	TablePack
} from './schema';

/** What the generator knows while it draws. Conditions and template variables read from it. */
export interface GenContext {
	preset: string;
	tier?: 1 | 2 | 3;
	ancestry?: string;
	gender?: 'f' | 'm' | 'n';
	/** Binary form of the gender for gendered surnames: a neutral request picks one. */
	sex?: 'f' | 'm';
	culture?: string;
	/** A second culture, for mixed-heritage templates. */
	alt?: string;
	archetype?: string;
	role?: string;
	tone?: string[];
	age?: string;
}

export interface MergedTable {
	id: string;
	entries: EntryObject[];
	phonetic: boolean;
	min: number;
	max: number;
	shape?: Shape;
}

export const asObject = (entry: Entry): EntryObject =>
	typeof entry === 'string' ? { v: entry } : entry;
export const weightOf = (entry: EntryObject): number => entry.w ?? 1;

/** Whether a context satisfies a condition: every listed key must share a value with the context. */
export function matches(when: Condition | undefined, ctx: GenContext): boolean {
	if (!when) return true;
	for (const key of Object.keys(when) as ConditionKey[]) {
		const allowed = when[key]!;
		const value = contextValue(ctx, key);
		if (value === undefined) return false;
		const values = Array.isArray(value) ? value : [String(value)];
		if (!values.some((v) => allowed.includes(v))) return false;
	}
	return true;
}

function contextValue(ctx: GenContext, key: ConditionKey): string | string[] | number | undefined {
	switch (key) {
		case 'preset':
			return ctx.preset;
		case 'tier':
			return ctx.tier;
		case 'ancestry':
			return ctx.ancestry;
		case 'gender':
			return ctx.gender;
		case 'archetype':
			return ctx.archetype;
		case 'role':
			return ctx.role;
		case 'tone':
			return ctx.tone;
		case 'age':
			return ctx.age;
	}
}

export class TableSet {
	private tables = new Map<string, MergedTable>();
	readonly versions: Record<string, number> = {};

	constructor(packs: readonly TablePack[]) {
		for (const pack of packs) {
			this.versions[pack.id] = pack.version;
			for (const [id, table] of Object.entries(pack.tables)) this.add(id, table);
		}
	}

	private add(id: string, table: Table) {
		const existing = this.tables.get(id);
		const entries = table.entries.map(asObject);
		if (existing && table.replace) {
			// A replacing table (a user's customised copy) stands in for everything merged so far.
			existing.entries.splice(0, existing.entries.length, ...entries);
			if (table.phonetic !== undefined) existing.phonetic = table.phonetic;
			if (table.min !== undefined) existing.min = table.min;
			if (table.max !== undefined) existing.max = table.max;
			if (table.shape !== undefined) existing.shape = table.shape;
			return;
		}
		if (existing) {
			existing.entries.push(...entries);
			if (table.phonetic) existing.phonetic = true;
			if (table.min !== undefined) existing.min = table.min;
			if (table.max !== undefined) existing.max = table.max;
			if (table.shape !== undefined) existing.shape = table.shape;
			return;
		}
		this.tables.set(id, {
			id,
			entries,
			phonetic: table.phonetic ?? false,
			min: table.min ?? 3,
			max: table.max ?? 12,
			...(table.shape ? { shape: table.shape } : {})
		});
	}

	has(id: string): boolean {
		return this.tables.has(id);
	}

	ids(): string[] {
		return [...this.tables.keys()];
	}

	table(id: string): MergedTable {
		const t = this.tables.get(id);
		if (!t) throw new Error(`Unknown table "${id}".`);
		return t;
	}

	/** The entries of a table a context may draw. */
	entries(id: string, ctx: GenContext): EntryObject[] {
		return this.table(id).entries.filter((e) => matches(e.when, ctx));
	}
}
