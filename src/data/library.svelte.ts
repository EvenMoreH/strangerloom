// The library: saved NPCs and parties, the roster, backup and import. Reactive copies of the tables; every write
// goes through the repository and reloads the affected list.
import {
	buildBackup,
	matches,
	npcSearchText,
	parseImport,
	partySearchText,
	remapIds
} from '../engine/export';
import { newId } from '../engine/ids';
import type {
	ChronicleEntry,
	Npc,
	Party,
	Recipe,
	RosterEntry,
	SavedNpc,
	SavedOverrides,
	SavedParty,
	TrackerState
} from '../engine/schema';
import { packs } from './packs.svelte';
import { prefs } from './prefs.svelte';
import { repo } from './repo';

export type RecordKind = 'npc' | 'party';
export type SavedRecord = SavedNpc | SavedParty;

export interface Filter {
	query: string;
	favourites: boolean;
	tag: string;
}

const now = () => new Date().toISOString();

function createLibrary() {
	let npcs = $state<SavedNpc[]>([]);
	let parties = $state<SavedParty[]>([]);
	let roster = $state<RosterEntry[]>([]);
	let ready = $state(false);
	let error = $state<string | null>(null);

	async function load() {
		try {
			[npcs, parties, roster] = await Promise.all([
				repo.listNpcs(),
				repo.listParties(),
				repo.listRoster()
			]);
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
		ready = true;
	}
	const loading = load();

	let chain: Promise<void> = Promise.resolve();
	function enqueue(task: () => Promise<void>): Promise<void> {
		chain = chain.then(task, task);
		return chain;
	}

	async function put(input: SavedRecord) {
		// Records arrive holding reactive proxies (the generator's recipe and result); IndexedDB clones plain objects only.
		const record = $state.snapshot(input) as SavedRecord;
		if ('npc' in record) {
			await repo.putNpc(record);
			npcs = await repo.listNpcs();
		} else {
			await repo.putParty(record);
			parties = await repo.listParties();
		}
	}

	const tags = $derived(
		[...new Set([...npcs, ...parties].flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b))
	);

	return {
		get npcs() {
			return npcs;
		},
		get parties() {
			return parties;
		},
		get roster() {
			return roster;
		},
		get tags() {
			return tags;
		},
		get ready() {
			return ready;
		},
		get error() {
			return error;
		},
		/** Resolves once the first load is done. */
		whenReady: () => loading,
		npc: (id: string) => npcs.find((r) => r.id === id),
		party: (id: string) => parties.find((r) => r.id === id),

		async saveNpc(
			recipe: Recipe,
			npc: Npc,
			overrides: SavedOverrides = {},
			tracker?: TrackerState
		): Promise<SavedNpc> {
			const at = now();
			const record: SavedNpc = {
				id: newId(),
				createdAt: at,
				updatedAt: at,
				recipe,
				npc,
				favourite: false,
				tags: [],
				notes: '',
				chronicle: [],
				overrides,
				...(tracker ? { tracker } : {})
			};
			await put(record);
			return record;
		},
		async saveParty(recipe: Recipe, party: Party): Promise<SavedParty> {
			const at = now();
			const record: SavedParty = {
				id: newId(),
				createdAt: at,
				updatedAt: at,
				recipe,
				party,
				favourite: false,
				tags: [],
				notes: '',
				chronicle: []
			};
			await put(record);
			return record;
		},
		/**
		 * Updates favourite, tags or notes of a record; `updatedAt` moves. Writes run one after another on the
		 * freshest copy, so two quick edits (tags, then notes) both land.
		 */
		update(
			record: SavedRecord,
			patch: Partial<Pick<SavedRecord, 'favourite' | 'tags' | 'notes' | 'chronicle'>>
		): Promise<void> {
			return enqueue(async () => {
				const list: SavedRecord[] = 'npc' in record ? npcs : parties;
				const current = list.find((r) => r.id === record.id) ?? record;
				await put({ ...current, ...patch, updatedAt: now() } as SavedRecord);
			});
		},
		/** Adds a chronicle entry dated now. */
		addChronicle(record: SavedRecord, text: string, label = ''): Promise<void> {
			const entry: ChronicleEntry = {
				id: newId(),
				at: now(),
				label: label.trim(),
				text: text.trim()
			};
			return enqueue(async () => {
				const list: SavedRecord[] = 'npc' in record ? npcs : parties;
				const current = list.find((r) => r.id === record.id) ?? record;
				await put({
					...current,
					chronicle: [...(current.chronicle ?? []), entry],
					updatedAt: now()
				} as SavedRecord);
			});
		},
		/** Changes the text or label of a chronicle entry; the date stays. */
		editChronicle(
			record: SavedRecord,
			id: string,
			patch: Partial<Pick<ChronicleEntry, 'label' | 'text'>>
		): Promise<void> {
			return enqueue(async () => {
				const list: SavedRecord[] = 'npc' in record ? npcs : parties;
				const current = list.find((r) => r.id === record.id) ?? record;
				await put({
					...current,
					chronicle: (current.chronicle ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
					updatedAt: now()
				} as SavedRecord);
			});
		},
		removeChronicle(record: SavedRecord, id: string): Promise<void> {
			return enqueue(async () => {
				const list: SavedRecord[] = 'npc' in record ? npcs : parties;
				const current = list.find((r) => r.id === record.id) ?? record;
				await put({
					...current,
					chronicle: (current.chronicle ?? []).filter((e) => e.id !== id),
					updatedAt: now()
				} as SavedRecord);
			});
		},
		async remove(record: SavedRecord) {
			if ('npc' in record) {
				await repo.deleteNpc(record.id);
				for (const r of roster.filter((e) => e.npcId === record.id)) await repo.deleteRoster(r.id);
				roster = await repo.listRoster();
				npcs = await repo.listNpcs();
			} else {
				await repo.deleteParty(record.id);
				parties = await repo.listParties();
			}
		},

		async addToRoster(npcId: string, label = '') {
			await repo.putRoster({ id: newId(), npcId, label, at: now() });
			roster = await repo.listRoster();
		},
		async relabelRoster(entry: RosterEntry, label: string) {
			await repo.putRoster({ ...entry, label });
			roster = await repo.listRoster();
		},
		async removeFromRoster(id: string) {
			await repo.deleteRoster(id);
			roster = await repo.listRoster();
		},
		async clearRoster() {
			await repo.clearRoster();
			roster = [];
		},

		/** The records that pass the filter, newest first. */
		filterNpcs(f: Filter): SavedNpc[] {
			return npcs.filter(
				(r) =>
					(!f.favourites || r.favourite) &&
					(!f.tag || r.tags.includes(f.tag)) &&
					(!f.query || matches(npcSearchText(r), f.query))
			);
		},
		filterParties(f: Filter): SavedParty[] {
			return parties.filter(
				(r) =>
					(!f.favourites || r.favourite) &&
					(!f.tag || r.tags.includes(f.tag)) &&
					(!f.query || matches(partySearchText(r), f.query))
			);
		},

		/** The whole library as backup JSON. */
		backupJson(): string {
			const p = {
				theme: prefs.theme,
				hiddenFields: prefs.hiddenFields,
				features: prefs.features,
				defaultView: prefs.defaultView
			};
			return JSON.stringify(buildBackup(npcs, parties, p, packs.snapshot()), null, 2);
		},
		/**
		 * Imports a backup, one record or a list of records. Colliding ids get fresh ones; nothing is overwritten.
		 * Throws `ImportError` or a JSON error with a readable message.
		 */
		async importJson(
			text: string
		): Promise<{ npcs: number; parties: number; packs: number; remapped: number }> {
			let data: unknown;
			try {
				data = JSON.parse(text);
			} catch {
				throw new Error('This file is not JSON.');
			}
			const parsed = parseImport(data);
			const taken = await repo.allIds();
			const a = remapIds(parsed.npcs, taken);
			const b = remapIds(parsed.parties, new Set([...taken, ...a.items.map((r) => r.id)]));
			await repo.importAll(a.items, b.items, parsed.packs);
			await Promise.all([load(), packs.importPacks([])]);
			return {
				npcs: a.items.length,
				parties: b.items.length,
				packs: parsed.packs.length,
				remapped: a.remapped + b.remapped
			};
		}
	};
}

export const library = createLibrary();
