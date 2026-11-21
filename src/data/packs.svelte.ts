// User packs: the GM's table packs and adapters, kept in the database and merged with the built-in content.
// Everything that needs a catalog or an adapter asks here, so edits show up at once. Built-in packs never change:
// a customised adapter is a user copy under the built-in id, a customised table is a user table that replaces the
// merged one, and deleting the user copy is the way back to the default.
import {
	adapterById as builtInAdapter,
	adapterChoices as builtInChoices,
	BUILT_IN_ADAPTERS,
	BUILT_IN_PACKS,
	catalogFor as builtInCatalog,
	PRESETS
} from '../content';
import { buildBackup, parseImport } from '../engine/export';
import type { Catalog } from '../engine/narrative';
import type { AdapterPack, Shape, TablePack, UserPack, UserPackKind } from '../engine/schema';
import { repo } from './repo';

export interface AdapterChoice {
	id: string;
	name: string;
	/** `builtin`, `custom` (a user copy of a built-in adapter) or `user` (the GM's own). */
	source: 'builtin' | 'custom' | 'user';
}

const now = () => new Date().toISOString();

function appliesTo(pack: { presets?: string[] }, presetId: string): boolean {
	return !pack.presets || pack.presets.includes(presetId);
}

function createPacks() {
	let packs = $state<UserPack[]>([]);
	let ready = $state(false);
	let error = $state<string | null>(null);

	async function load() {
		try {
			packs = await repo.listPacks();
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
		ready = true;
	}
	const loading = load();

	const tablePacks = $derived(
		packs.filter((p): p is UserPack & { kind: 'tables' } => p.kind === 'tables')
	);
	const adapterPacks = $derived(
		packs.filter((p): p is UserPack & { kind: 'adapter' } => p.kind === 'adapter')
	);

	function userAdapter(id: string): AdapterPack | undefined {
		return adapterPacks.find((p) => p.enabled && p.pack.id === id)?.pack;
	}

	return {
		get ready() {
			return ready;
		},
		get error() {
			return error;
		},
		whenReady: () => loading,
		/** Every user pack, table packs first, then adapters, each group by id. */
		get list(): UserPack[] {
			return [...tablePacks, ...adapterPacks].sort(
				(a, b) => a.kind.localeCompare(b.kind) || a.pack.id.localeCompare(b.pack.id)
			);
		},
		get tablePacks() {
			return tablePacks;
		},
		get adapterPacks() {
			return adapterPacks;
		},
		/** The user pack of one kind and id, enabled or not. */
		find(kind: UserPackKind, id: string): UserPack | undefined {
			return packs.find((p) => p.kind === kind && p.pack.id === id);
		},
		/** The catalog for a preset: built-in packs, then the enabled user table packs open to the preset. */
		catalogFor(presetId: string): Catalog {
			const extra = tablePacks
				.filter((p) => p.enabled && appliesTo(p.pack, presetId))
				.map((p) => p.pack);
			return builtInCatalog(presetId, extra);
		},
		/** The shape of a table (`Table.shape`): the last enabled user pack that sets it, else the built-in packs. */
		tableShape(tableId: string): Shape | undefined {
			let shape: Shape | undefined;
			for (const p of [
				...BUILT_IN_PACKS,
				...tablePacks.filter((p) => p.enabled).map((p) => p.pack)
			]) {
				const s = p.tables[tableId]?.shape;
				if (s) shape = s;
			}
			return shape;
		},
		/** The user table packs a preset would use, for the editor. */
		tablePacksFor(presetId: string): TablePack[] {
			return tablePacks.filter((p) => appliesTo(p.pack, presetId)).map((p) => p.pack);
		},
		/** An adapter by id: the GM's enabled copy when there is one, else the built-in one. */
		adapterById(id: string): AdapterPack | undefined {
			return userAdapter(id) ?? builtInAdapter(id);
		},
		isBuiltInAdapter: (id: string) => BUILT_IN_ADAPTERS.some((a) => a.id === id),
		isBuiltInTablePack: (id: string) => BUILT_IN_PACKS.some((p) => p.id === id),
		/** Adapter choices for a preset: the built-in list (user copies in place), then the GM's own. */
		adapterChoices(presetId: string): AdapterChoice[] {
			const base: AdapterChoice[] = builtInChoices(presetId).map((c) => {
				const user = userAdapter(c.id);
				return user ? { id: c.id, name: user.name, source: 'custom' } : { ...c, source: 'builtin' };
			});
			const own: AdapterChoice[] = adapterPacks
				.filter(
					(p) =>
						p.enabled &&
						!BUILT_IN_ADAPTERS.some((a) => a.id === p.pack.id) &&
						p.pack.id !== 'generic'
				)
				.filter((p) => appliesTo(p.pack, presetId))
				.map((p) => ({ id: p.pack.id, name: p.pack.name, source: 'user' }));
			return [...base, ...own];
		},
		/** The preset's default adapter id, for pickers that need a fallback. */
		defaultAdapter(presetId: string): string {
			return (PRESETS.presets.find((p) => p.id === presetId) ?? PRESETS.presets[0]).adapter;
		},
		/** Saves (or replaces) a table pack as an enabled user pack, keeping its enabled flag when it exists. */
		async saveTablePack(pack: TablePack): Promise<void> {
			const existing = packs.find((p) => p.kind === 'tables' && p.pack.id === pack.id);
			await repo.putPack({
				kind: 'tables',
				enabled: existing?.enabled ?? true,
				updatedAt: now(),
				pack
			});
			await load();
		},
		async saveAdapter(pack: AdapterPack): Promise<void> {
			const existing = packs.find((p) => p.kind === 'adapter' && p.pack.id === pack.id);
			await repo.putPack({
				kind: 'adapter',
				enabled: existing?.enabled ?? true,
				updatedAt: now(),
				pack
			});
			await load();
		},
		/** Removes a user pack: a customised adapter or table pack goes back to the built-in default. */
		async remove(kind: UserPackKind, id: string): Promise<void> {
			await repo.deletePack(kind, id);
			await load();
		},
		async setEnabled(kind: UserPackKind, id: string, enabled: boolean): Promise<void> {
			const existing = packs.find((p) => p.kind === kind && p.pack.id === id);
			if (!existing) return;
			await repo.putPack({ ...$state.snapshot(existing), enabled, updatedAt: now() } as UserPack);
			await load();
		},
		/** Removes every user pack. Everything is back to the built-in defaults. */
		async resetAll(): Promise<void> {
			await repo.clearPacks();
			await load();
		},
		/** Imports the packs of a file: a pack file, or a backup (its records are left alone). Returns the count. */
		async importJson(text: string): Promise<number> {
			let data: unknown;
			try {
				data = JSON.parse(text);
			} catch {
				throw new Error('This file is not JSON.');
			}
			const parsed = parseImport(data);
			if (!parsed.packs.length) throw new Error('This file holds no packs.');
			await repo.importAll([], [], parsed.packs);
			await load();
			return parsed.packs.length;
		},
		/** Puts imported packs (replacing packs with the same key) and reloads. */
		async importPacks(imported: UserPack[]): Promise<void> {
			if (imported.length) await repo.importAll([], [], imported);
			await load();
		},
		/** One pack as its own file: a table pack or an adapter, importable on its own. */
		packJson(kind: UserPackKind, id: string): string | null {
			const p = packs.find((p) => p.kind === kind && p.pack.id === id);
			return p ? JSON.stringify($state.snapshot(p.pack), null, 2) : null;
		},
		/** Every user pack in a backup file that holds nothing else. */
		allJson(): string {
			return JSON.stringify(buildBackup([], [], {}, $state.snapshot(packs) as UserPack[]), null, 2);
		},
		/** For the library backup. */
		snapshot(): UserPack[] {
			return $state.snapshot(packs) as UserPack[];
		}
	};
}

export const packs = createPacks();
