// Saved records and the library backup file.
import { z } from 'zod';
import { AdapterPack } from './adapter';
import { Party } from './party';
import { Npc } from './profile';
import { Recipe } from './recipe';
import { TablePack } from './tablePack';

/** Hit points and conditions of a saved combat NPC, as the tracker left them. */
export const TrackerState = z.object({
	hp: z.number().int(),
	hpMax: z.number().int(),
	conditions: z.array(z.string()).default([])
});
export type TrackerState = z.infer<typeof TrackerState>;

/** Manual stat block overrides: adapter id, then line id, then the GM's text. */
export const SavedOverrides = z.record(z.string(), z.record(z.string(), z.string()));
export type SavedOverrides = z.infer<typeof SavedOverrides>;

/** One dated entry of a record's chronicle: what happened with this NPC or party, session by session. */
export const ChronicleEntry = z.object({
	id: z.string().min(1),
	at: z.string(),
	/** Free label, usually the session ("Session 4"). */
	label: z.string().default(''),
	text: z.string()
});
export type ChronicleEntry = z.infer<typeof ChronicleEntry>;

const record = {
	id: z.string().min(1),
	createdAt: z.string(),
	updatedAt: z.string(),
	recipe: Recipe,
	favourite: z.boolean().default(false),
	tags: z.array(z.string()).default([]),
	notes: z.string().default(''),
	chronicle: z.array(ChronicleEntry).default([])
};

export const SavedNpc = z.object({
	...record,
	npc: Npc,
	overrides: SavedOverrides.default({}),
	tracker: TrackerState.optional()
});
export type SavedNpc = z.infer<typeof SavedNpc>;

export const SavedParty = z.object({
	...record,
	party: Party
});
export type SavedParty = z.infer<typeof SavedParty>;

/** One NPC the players met: a pointer into the library with a label ("the innkeeper") and a time. */
export const RosterEntry = z.object({
	id: z.string().min(1),
	npcId: z.string().min(1),
	label: z.string().default(''),
	at: z.string()
});
export type RosterEntry = z.infer<typeof RosterEntry>;

/**
 * A user's pack: a table pack of their own (adding to or replacing built-in tables) or an adapter (a new one, or a
 * customised copy of a built-in one under the same id). Built-in packs never change; deleting the user pack is the
 * way back to the default.
 */
const userPackBase = {
	enabled: z.boolean().default(true),
	updatedAt: z.string()
};
export const UserPack = z.discriminatedUnion('kind', [
	z.object({ ...userPackBase, kind: z.literal('tables'), pack: TablePack }),
	z.object({ ...userPackBase, kind: z.literal('adapter'), pack: AdapterPack })
]);
export type UserPack = z.infer<typeof UserPack>;
export type UserPackKind = UserPack['kind'];
/** The row id of a user pack: kind and pack id, so a user adapter may share its id with a built-in one. */
export const userPackKey = (kind: UserPackKind, id: string) => `${kind}:${id}`;

export const LIBRARY_FORMAT = 'strangerloom-library';
export const LIBRARY_VERSION = 1;

export const LibraryBackup = z.object({
	format: z.literal(LIBRARY_FORMAT),
	version: z.literal(LIBRARY_VERSION),
	exportedAt: z.string(),
	npcs: z.array(SavedNpc).default([]),
	parties: z.array(SavedParty).default([]),
	packs: z.array(UserPack).default([]),
	prefs: z.record(z.string(), z.unknown()).default({})
});
export type LibraryBackup = z.infer<typeof LibraryBackup>;
