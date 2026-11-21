// Typed access to the database. Records go in and out as validated schema objects; nothing else touches Dexie.
import {
	userPackKey,
	type RosterEntry,
	type SavedNpc,
	type SavedParty,
	type UserPack,
	type UserPackKind
} from '../engine/schema';
import { db, type UserPackRow } from './db';

const rowOf = (p: UserPack): UserPackRow => ({ ...p, id: userPackKey(p.kind, p.pack.id) });
function packOf(row: UserPackRow): UserPack {
	const { id, ...pack } = row;
	void id;
	return pack as UserPack;
}

export const repo = {
	listNpcs: (): Promise<SavedNpc[]> => db.npcs.orderBy('updatedAt').reverse().toArray(),
	listParties: (): Promise<SavedParty[]> => db.parties.orderBy('updatedAt').reverse().toArray(),
	listRoster: (): Promise<RosterEntry[]> => db.roster.orderBy('at').toArray(),
	listPacks: async (): Promise<UserPack[]> => (await db.packs.toArray()).map(packOf),
	putNpc: (r: SavedNpc): Promise<string> => db.npcs.put(r),
	putParty: (r: SavedParty): Promise<string> => db.parties.put(r),
	putRoster: (r: RosterEntry): Promise<string> => db.roster.put(r),
	putPack: (p: UserPack): Promise<string> => db.packs.put(rowOf(p)),
	deleteNpc: (id: string): Promise<void> => db.npcs.delete(id),
	deleteParty: (id: string): Promise<void> => db.parties.delete(id),
	deleteRoster: (id: string): Promise<void> => db.roster.delete(id),
	deletePack: (kind: UserPackKind, id: string): Promise<void> =>
		db.packs.delete(userPackKey(kind, id)),
	clearRoster: (): Promise<void> => db.roster.clear(),
	clearPacks: (): Promise<void> => db.packs.clear(),
	/** Puts imported records and packs in one transaction. A pack with a taken key replaces it. */
	importAll: (npcs: SavedNpc[], parties: SavedParty[], packs: UserPack[] = []): Promise<void> =>
		db.transaction('rw', db.npcs, db.parties, db.packs, async () => {
			await db.npcs.bulkPut(npcs);
			await db.parties.bulkPut(parties);
			await db.packs.bulkPut(packs.map(rowOf));
		}),
	allIds: async (): Promise<Set<string>> =>
		new Set([
			...(await db.npcs.toCollection().primaryKeys()),
			...(await db.parties.toCollection().primaryKeys())
		])
};
