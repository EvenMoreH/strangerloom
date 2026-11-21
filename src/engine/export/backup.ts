// The library backup file and what an import accepts: a backup, one saved record, or a list of records.
import { newId } from '../ids';
import { packKindOf } from '../packs';
import {
	AdapterPack,
	LIBRARY_FORMAT,
	LIBRARY_VERSION,
	LibraryBackup,
	SavedNpc,
	SavedParty,
	TablePack,
	type SavedNpc as SavedNpcT,
	type SavedParty as SavedPartyT,
	type UserPack
} from '../schema';

export class ImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImportError';
	}
}

export function buildBackup(
	npcs: SavedNpcT[],
	parties: SavedPartyT[],
	prefs: Record<string, unknown> = {},
	packs: UserPack[] = [],
	now = new Date()
): LibraryBackup {
	return {
		format: LIBRARY_FORMAT,
		version: LIBRARY_VERSION,
		exportedAt: now.toISOString(),
		npcs,
		parties,
		packs,
		prefs
	};
}

export interface Imported {
	npcs: SavedNpcT[];
	parties: SavedPartyT[];
	/** User packs: table packs and adapters, enabled, stamped with the import time. */
	packs: UserPack[];
	prefs: Record<string, unknown>;
}

/** Parses import JSON. Throws `ImportError` with a message a GM can read. */
export function parseImport(data: unknown): Imported {
	if (Array.isArray(data)) {
		const out: Imported = { npcs: [], parties: [], packs: [], prefs: {} };
		for (const item of data) {
			const one = parseImport(item);
			out.npcs.push(...one.npcs);
			out.parties.push(...one.parties);
			out.packs.push(...one.packs);
		}
		return out;
	}
	if (!data || typeof data !== 'object')
		throw new ImportError('This file is not a Strangerloom export.');
	const obj = data as Record<string, unknown>;
	if (obj.format === LIBRARY_FORMAT) {
		const backup = LibraryBackup.safeParse(obj);
		if (!backup.success) {
			throw new ImportError(
				obj.version !== LIBRARY_VERSION
					? `This backup has format version ${String(obj.version)}; this app reads version ${LIBRARY_VERSION}.`
					: 'This backup is damaged and cannot be read.'
			);
		}
		return {
			npcs: backup.data.npcs,
			parties: backup.data.parties,
			packs: backup.data.packs,
			prefs: backup.data.prefs
		};
	}
	const kind = packKindOf(obj);
	if (kind === 'tables') {
		const pack = TablePack.safeParse(obj);
		if (!pack.success) throw new ImportError('This table pack cannot be read.');
		return { npcs: [], parties: [], packs: [userPackOf(kind, pack.data)], prefs: {} };
	}
	if (kind === 'adapter') {
		const pack = AdapterPack.safeParse(obj);
		if (!pack.success) throw new ImportError('This adapter pack cannot be read.');
		return { npcs: [], parties: [], packs: [userPackOf(kind, pack.data)], prefs: {} };
	}
	if ('npc' in obj) {
		const npc = SavedNpc.safeParse(obj);
		if (!npc.success) throw new ImportError('This NPC record cannot be read.');
		return { npcs: [npc.data], parties: [], packs: [], prefs: {} };
	}
	if ('party' in obj) {
		const party = SavedParty.safeParse(obj);
		if (!party.success) throw new ImportError('This party record cannot be read.');
		return { npcs: [], parties: [party.data], packs: [], prefs: {} };
	}
	throw new ImportError('This file is not a Strangerloom export.');
}

/** Wraps a pack file as an enabled user pack stamped now. */
export function userPackOf(kind: 'tables', pack: TablePack): UserPack;
export function userPackOf(kind: 'adapter', pack: AdapterPack): UserPack;
export function userPackOf(kind: UserPack['kind'], pack: TablePack | AdapterPack): UserPack {
	const updatedAt = new Date().toISOString();
	return kind === 'tables'
		? { kind, enabled: true, updatedAt, pack: pack as TablePack }
		: { kind, enabled: true, updatedAt, pack: pack as AdapterPack };
}

/** Gives a fresh id to every record whose id is already taken, so an import never overwrites a record. */
export function remapIds<T extends { id: string }>(
	items: T[],
	taken: ReadonlySet<string>,
	fresh: () => string = newId
): { items: T[]; remapped: number } {
	const used = new Set(taken);
	let remapped = 0;
	const out = items.map((item) => {
		if (!used.has(item.id)) {
			used.add(item.id);
			return item;
		}
		let id = fresh();
		while (used.has(id)) id = fresh();
		used.add(id);
		remapped++;
		return { ...item, id };
	});
	return { items: out, remapped };
}
