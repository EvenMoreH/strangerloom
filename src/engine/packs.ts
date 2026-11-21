// User packs: validation of table and adapter packs a GM writes or imports, the table edits the editor makes, and
// the text form of an entry condition.
import { AdapterError, renderAdapter } from './adapter';
import type { Catalog } from './narrative';
import {
	AdapterPack,
	CONDITION_KEYS,
	TablePack,
	type Condition,
	type ConditionKey,
	type DamageAnchors,
	type Entry,
	type EntryObject,
	type Npc,
	type Table
} from './schema';
import { TableSet } from './tables';

const TOKEN = /\{([^{}]+)\}/g;
const VARIABLE = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
const VARIABLES = ['g', 'sex', 'culture', 'alt', 'ancestry', 'archetype'];

export interface Checked<T> {
	pack?: T;
	errors: string[];
}

function zodErrors(issues: { path: PropertyKey[]; message: string }[]): string[] {
	return issues.slice(0, 12).map((i) => `${i.path.map(String).join('.') || 'pack'}: ${i.message}`);
}

/** Reads the `format` field to tell table packs from adapters. */
export function packKindOf(data: unknown): 'tables' | 'adapter' | null {
	if (!data || typeof data !== 'object') return null;
	const format = (data as { format?: unknown }).format;
	if (format === 'strangerloom-tables') return 'tables';
	if (format === 'strangerloom-adapter') return 'adapter';
	return null;
}

/**
 * Validates a table pack: the schema, then every `{table}` token against the tables it will be merged with
 * (`builtIns`, usually the packs of the presets it applies to) plus its own, variables replaced by any value.
 */
export function checkTablePack(data: unknown, builtIns: readonly TablePack[]): Checked<TablePack> {
	const parsed = TablePack.safeParse(data);
	if (!parsed.success) return { errors: zodErrors(parsed.error.issues) };
	const pack = parsed.data;
	const errors: string[] = [];
	if (builtIns.some((b) => b.id === pack.id)) {
		errors.push(`Pack id "${pack.id}" belongs to a built-in pack. Choose another id.`);
	}
	const set = new TableSet([...builtIns, pack]);
	for (const [id, table] of Object.entries(pack.tables)) {
		table.entries.forEach((entry, i) => {
			const v = typeof entry === 'string' ? entry : entry.v;
			for (const m of v.matchAll(TOKEN)) {
				const key = m[1];
				if (key.includes('$')) {
					// Resolved per context; only the variable names can be checked.
					for (const variable of key.matchAll(VARIABLE)) {
						if (!VARIABLES.includes(variable[1])) {
							errors.push(`${id} entry ${i + 1}: unknown variable $${variable[1]} in {${key}}.`);
						}
					}
					continue;
				}
				if (!set.has(key)) errors.push(`${id} entry ${i + 1}: unknown table {${key}}.`);
			}
		});
	}
	return errors.length ? { pack, errors } : { pack, errors: [] };
}

/** Validates an adapter pack: the schema, then a render of every sample NPC, so formula errors show up. */
export function checkAdapterPack(
	data: unknown,
	samples: readonly Npc[],
	anchors?: DamageAnchors
): Checked<AdapterPack> {
	const parsed = AdapterPack.safeParse(data);
	if (!parsed.success) return { errors: zodErrors(parsed.error.issues) };
	const pack = parsed.data;
	const errors: string[] = [];
	for (const npc of samples) {
		try {
			renderAdapter(pack, npc, anchors ? { anchors } : {});
		} catch (err) {
			const message = err instanceof AdapterError ? err.message : String(err);
			if (!errors.includes(message)) errors.push(message);
		}
	}
	return { pack, errors };
}

/** A fresh, empty table pack. */
export function newTablePack(id: string, name: string, presets?: string[]): TablePack {
	return {
		format: 'strangerloom-tables',
		schemaVersion: 1,
		id,
		name,
		version: 1,
		...(presets?.length ? { presets } : {}),
		tables: {}
	};
}

/** A copy of an adapter under a new id and name, version 1. */
export function cloneAdapter(pack: AdapterPack, id: string, name: string): AdapterPack {
	return { ...structuredClone(pack), id, name, version: 1 };
}

/** The pack with one table set (added or replaced) and the version moved on. */
export function withTable(pack: TablePack, id: string, table: Table): TablePack {
	return { ...pack, version: pack.version + 1, tables: { ...pack.tables, [id]: table } };
}

/** The pack without one table and the version moved on. */
export function withoutTable(pack: TablePack, id: string): TablePack {
	const tables = { ...pack.tables };
	delete tables[id];
	return { ...pack, version: pack.version + 1, tables };
}

/** The merged entries of a table in a catalog, as objects, for a customised copy. */
export function mergedEntries(catalog: Catalog, tableId: string): EntryObject[] {
	return catalog.tables.has(tableId)
		? catalog.tables.table(tableId).entries.map((e) => ({ ...e }))
		: [];
}

/** An entry in its short form: a bare string when it carries nothing else. */
export function compactEntry(e: EntryObject): Entry {
	const { v, w, tags, when, meta } = e;
	if ((w === undefined || w === 1) && !tags?.length && !(when && Object.keys(when).length) && !meta)
		return v;
	return {
		v,
		...(w !== undefined && w !== 1 ? { w } : {}),
		...(tags?.length ? { tags } : {}),
		...(when && Object.keys(when).length ? { when } : {}),
		...(meta ? { meta } : {})
	};
}

/** `preset: high-fantasy, grimdark; gender: f` */
export function conditionToText(when: Condition | undefined): string {
	if (!when) return '';
	return Object.entries(when)
		.filter(([, v]) => v && v.length)
		.map(([k, v]) => `${k}: ${v!.join(', ')}`)
		.join('; ');
}

/** Parses the text form back. Returns the condition (undefined when empty) or an error message. */
export function textToCondition(text: string): { when?: Condition; error?: string } {
	const out: Condition = {};
	for (const part of text.split(';')) {
		const piece = part.trim();
		if (!piece) continue;
		const colon = piece.indexOf(':');
		if (colon < 0) return { error: `"${piece}" needs the form key: value, value.` };
		const key = piece.slice(0, colon).trim();
		const values = piece
			.slice(colon + 1)
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean);
		if (!(CONDITION_KEYS as readonly string[]).includes(key)) {
			return { error: `"${key}" is not a condition key (${CONDITION_KEYS.join(', ')}).` };
		}
		if (!values.length) return { error: `"${key}" has no values.` };
		out[key as ConditionKey] = values;
	}
	return Object.keys(out).length ? { when: out } : {};
}
