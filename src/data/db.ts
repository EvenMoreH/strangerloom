// Dexie (IndexedDB) database: saved NPCs and parties, user packs and the session roster.
import Dexie, { type EntityTable } from 'dexie';
import type { RosterEntry, SavedNpc, SavedParty, UserPack } from '../engine/schema';

/** A user pack row. `id` is `userPackKey(kind, pack.id)`, so a user adapter may share its id with a built-in one. */
export type UserPackRow = UserPack & { id: string };

export class StrangerloomDb extends Dexie {
	npcs!: EntityTable<SavedNpc, 'id'>;
	parties!: EntityTable<SavedParty, 'id'>;
	packs!: EntityTable<UserPackRow, 'id'>;
	roster!: EntityTable<RosterEntry, 'id'>;

	constructor(name = 'strangerloom') {
		super(name);
		this.version(1).stores({
			npcs: 'id, updatedAt, favourite, *tags',
			parties: 'id, updatedAt, favourite, *tags',
			packs: 'id, kind',
			roster: 'id, at'
		});
	}
}

export const db = new StrangerloomDb();
