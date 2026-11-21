<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import { BUILT_IN_PACKS, PRESETS } from '../../content';
	import { packs } from '../../data/packs.svelte';
	import {
		checkTablePack,
		compactEntry,
		conditionToText,
		mergedEntries,
		newTablePack,
		textToCondition,
		withoutTable,
		withTable
	} from '../../engine/packs';
	import type { EntryObject, Shape, Table, TablePack } from '../../engine/schema';
	import { SLUG } from '../../engine/schema';

	let { onnotice }: { onnotice: (text: string) => void } = $props();

	const DEFAULT_PACK = 'my-tables';

	let presetId = $state(PRESETS.presets[0].id);
	let workingId = $state(DEFAULT_PACK);
	let query = $state('');
	let selected = $state<string | null>(null);
	let newTableId = $state('');
	let jsonMode = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');

	/** An entry under edit: the condition as text so it can be typed. */
	interface Row {
		v: string;
		w: string;
		when: string;
		tags: string;
	}
	let rows = $state<Row[]>([]);
	let replace = $state(true);
	let dirty = $state(false);
	let errors = $state<string[]>([]);

	const catalog = $derived(packs.catalogFor(presetId));
	const userPacks = $derived(packs.tablePacksFor(presetId));
	/** The pack edits go to: an existing user pack or a fresh one that is saved with the first edit. */
	const working = $derived<TablePack>(
		userPacks.find((p) => p.id === workingId) ?? newTablePack(workingId, 'My tables')
	);
	const builtIns = $derived(
		BUILT_IN_PACKS.filter((p) =>
			PRESETS.presets.find((x) => x.id === presetId)?.packs.includes(p.id)
		)
	);
	const tableIds = $derived(
		[...new Set([...catalog.tables.ids(), ...Object.keys(working.tables)])]
			.filter((id) => !query || id.includes(query.toLowerCase()))
			.sort()
	);
	const userTable = $derived(selected ? working.tables[selected] : undefined);
	/** The shape the entries of the selected table are written in: the user's setting, else the merged one. */
	const shape = $derived(
		userTable?.shape ??
			(selected && catalog.tables.has(selected) ? catalog.tables.table(selected).shape : undefined)
	);
	const SHAPE_HINT: Record<Shape, string> = {
		verb: 'Entries are verb phrases after a name, such as "has a tremor in one hand".',
		noun: 'Entries are noun phrases with their article, such as "a pipe that is never lit".',
		adjective: 'Entries are adjectives, such as "wary".',
		sentence: 'Entries are whole sentences.'
	};
	const inBuiltIns = $derived(selected ? builtIns.some((p) => selected! in p.tables) : false);

	function sourceOf(id: string): 'customised' | 'extended' | 'own' | 'built-in' {
		const t = working.tables[id];
		if (!t) return 'built-in';
		if (t.replace) return 'customised';
		return builtIns.some((p) => id in p.tables) ? 'extended' : 'own';
	}

	function toRows(entries: EntryObject[]): Row[] {
		return entries.map((e) => ({
			v: e.v,
			w: e.w === undefined || e.w === 1 ? '' : String(e.w),
			when: conditionToText(e.when),
			tags: e.tags?.join(', ') ?? ''
		}));
	}

	function loadRows() {
		const t = userTable;
		rows = t ? toRows(t.entries.map((e) => (typeof e === 'string' ? { v: e } : e))) : [];
		replace = t?.replace ?? false;
		dirty = false;
		errors = [];
		jsonMode = false;
	}

	function select(id: string) {
		selected = id;
		loadRows();
	}

	/** The draft table, or the list of problems. */
	function draftTable(): { table?: Table; errors: string[] } {
		const out: string[] = [];
		const entries = rows.map((r, i) => {
			const w = r.w.trim() === '' ? undefined : Number(r.w);
			if (w !== undefined && (!Number.isFinite(w) || w <= 0))
				out.push(`Entry ${i + 1}: weight must be a positive number.`);
			const cond = textToCondition(r.when);
			if (cond.error) out.push(`Entry ${i + 1}: ${cond.error}`);
			if (!r.v.trim()) out.push(`Entry ${i + 1}: the value is empty.`);
			const tags = r.tags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			return compactEntry({ v: r.v, w, when: cond.when, tags });
		});
		if (!entries.length) out.push('A table needs at least one entry.');
		if (out.length) return { errors: out };
		const table: Table = { entries, ...(replace ? { replace: true } : {}) };
		const prior = userTable;
		if (prior?.phonetic !== undefined) table.phonetic = prior.phonetic;
		if (prior?.min !== undefined) table.min = prior.min;
		if (prior?.max !== undefined) table.max = prior.max;
		if (prior?.shape !== undefined) table.shape = prior.shape;
		return { table, errors: [] };
	}

	async function savePack(next: TablePack, notice: string) {
		const check = checkTablePack(next, builtIns);
		if (check.errors.length) {
			errors = check.errors;
			return false;
		}
		try {
			await packs.saveTablePack(next);
			errors = [];
			dirty = false;
			onnotice(notice);
			return true;
		} catch (err) {
			errors = [err instanceof Error ? err.message : String(err)];
			return false;
		}
	}

	async function save() {
		if (!selected) return;
		if (jsonMode) {
			let table: unknown;
			try {
				table = JSON.parse(jsonText);
			} catch {
				jsonError = 'This is not JSON.';
				return;
			}
			const probe = withTable(working, selected, table as Table);
			if (await savePack(probe, 'Table saved')) {
				jsonError = '';
				loadRows();
			}
			return;
		}
		const draft = draftTable();
		if (!draft.table) {
			errors = draft.errors;
			return;
		}
		await savePack(withTable(working, selected, draft.table), 'Table saved');
	}

	/** Copies the merged entries into the working pack as a replacing table, ready to edit. */
	async function customise() {
		if (!selected) return;
		const entries = mergedEntries(catalog, selected).map(compactEntry);
		const merged = catalog.tables.table(selected);
		const table: Table = { entries, replace: true };
		if (merged.phonetic) table.phonetic = merged.phonetic;
		if (merged.min !== undefined) table.min = merged.min;
		if (merged.max !== undefined) table.max = merged.max;
		if (merged.shape !== undefined) table.shape = merged.shape;
		if (await savePack(withTable(working, selected, table), 'Table copied into your pack'))
			loadRows();
	}

	/** Starts an additive table in the working pack with one blank entry. */
	async function extend() {
		if (!selected) return;
		if (await savePack(withTable(working, selected, { entries: ['New entry'] }), 'Table extended'))
			loadRows();
	}

	async function revert() {
		if (!selected) return;
		const next = withoutTable(working, selected);
		if (Object.keys(next.tables).length === 0 && userPacks.some((p) => p.id === working.id)) {
			await packs.remove('tables', working.id);
			onnotice('Back to default');
			loadRows();
			return;
		}
		if (await savePack(next, 'Back to default')) loadRows();
	}

	async function addTable() {
		const id = newTableId.trim().toLowerCase();
		if (!SLUG.test(id)) {
			errors = ['A table id uses lower-case letters, digits, dots and dashes, like "my-table".'];
			return;
		}
		if (await savePack(withTable(working, id, { entries: ['New entry'] }), 'Table added')) {
			newTableId = '';
			select(id);
		}
	}

	function addRow() {
		rows = [...rows, { v: '', w: '', when: '', tags: '' }];
		dirty = true;
	}
	function removeRow(i: number) {
		rows = rows.filter((_, j) => j !== i);
		dirty = true;
	}
	function toggleJson() {
		if (!jsonMode && userTable) jsonText = JSON.stringify(userTable, null, 2);
		jsonMode = !jsonMode;
		jsonError = '';
	}
	function setPreset(id: string) {
		presetId = id;
		selected = null;
		rows = [];
	}
	function setWorking(id: string) {
		workingId = id;
		loadRows();
	}
</script>

<div class="flex flex-wrap items-end gap-3">
	<label class="flex flex-col gap-1 text-sm">
		<span class="text-ink-muted">Setting</span>
		<select
			class="rounded border border-border bg-surface px-2 py-1.5"
			value={presetId}
			onchange={(e) => setPreset(e.currentTarget.value)}
		>
			{#each PRESETS.presets as p (p.id)}
				<option value={p.id}>{p.name}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="text-ink-muted">Your pack</span>
		<select
			class="rounded border border-border bg-surface px-2 py-1.5"
			value={workingId}
			onchange={(e) => setWorking(e.currentTarget.value)}
		>
			{#if !userPacks.some((p) => p.id === DEFAULT_PACK)}
				<option value={DEFAULT_PACK}>My tables (new)</option>
			{/if}
			{#each userPacks as p (p.id)}
				<option value={p.id}>{p.name} ({p.id})</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-1 flex-col gap-1 text-sm">
		<span class="text-ink-muted">Find table</span>
		<input
			class="rounded border border-border bg-surface px-2 py-1.5"
			bind:value={query}
			placeholder="occupation"
		/>
	</label>
</div>

<div class="mt-4 grid gap-4 md:grid-cols-[16rem_1fr]">
	<div>
		<ul class="max-h-[32rem] overflow-y-auto rounded border border-border" aria-label="Tables">
			{#each tableIds as id (id)}
				{@const source = sourceOf(id)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2 aria-pressed:bg-surface-3"
						aria-pressed={selected === id}
						onclick={() => select(id)}
					>
						<span class="flex-1 truncate font-mono text-xs">{id}</span>
						{#if source !== 'built-in'}
							<span class="rounded bg-accent-fill px-1.5 text-[10px] text-accent-ink uppercase"
								>{source}</span
							>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		<form class="mt-2 flex gap-1" onsubmit={(e) => (e.preventDefault(), addTable())}>
			<input
				class="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 font-mono text-xs"
				bind:value={newTableId}
				placeholder="new.table-id"
				aria-label="New table id"
			/>
			<button type="submit" class="rounded border border-border px-2 text-sm hover:bg-surface-3"
				>New table</button
			>
		</form>
	</div>

	<div>
		{#if !selected}
			<p class="text-sm text-ink-muted">
				Pick a table. Built-in tables can be customised (your copy replaces the default) or extended
				(your entries are added to the default).
			</p>
		{:else}
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="font-mono text-sm font-semibold">{selected}</h2>
				<span class="text-xs text-ink-muted">{sourceOf(selected)}</span>
				{#if shape}<span class="text-xs text-ink-muted" data-shape={shape}>{SHAPE_HINT[shape]}</span
					>{/if}
				<div class="ml-auto flex flex-wrap gap-1">
					{#if !userTable}
						<button
							type="button"
							class="rounded bg-accent-fill px-3 py-1.5 text-sm text-accent-ink glow"
							onclick={customise}>Customise</button
						>
						<button
							type="button"
							class="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
							onclick={extend}>Add entries</button
						>
					{:else}
						<button
							type="button"
							class="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
							onclick={toggleJson}>{jsonMode ? 'Edit as list' : 'Edit as JSON'}</button
						>
						<button
							type="button"
							class="rounded border border-border px-3 py-1.5 text-sm text-danger hover:bg-surface-3"
							onclick={revert}>{inBuiltIns ? 'Revert to default' : 'Delete table'}</button
						>
						<button
							type="button"
							class="rounded bg-accent-fill px-3 py-1.5 text-sm text-accent-ink glow disabled:opacity-50"
							disabled={!dirty && !jsonMode}
							onclick={save}>Save</button
						>
					{/if}
				</div>
			</div>

			{#if errors.length}
				<ul class="mt-2 rounded border border-danger p-2 text-sm text-danger" role="alert">
					{#each errors as e, i (i)}<li>{e}</li>{/each}
				</ul>
			{/if}

			{#if !userTable}
				<ol
					class="mt-3 max-h-[28rem] list-decimal overflow-y-auto pl-8 text-sm"
					aria-label="Default entries"
				>
					{#each mergedEntries(catalog, selected) as e, i (i)}
						<li class="py-0.5">
							{e.v}
							{#if e.w !== undefined && e.w !== 1}<span class="text-ink-muted"> ×{e.w}</span>{/if}
							{#if e.when}<span class="text-xs text-ink-muted">
									[{conditionToText(e.when)}]</span
								>{/if}
						</li>
					{/each}
				</ol>
			{:else if jsonMode}
				<textarea
					class="mt-3 h-96 w-full rounded border border-border bg-surface p-2 font-mono text-xs"
					bind:value={jsonText}
					aria-label="Table JSON"
					spellcheck="false"></textarea>
				{#if jsonError}<p class="text-sm text-danger" role="alert">{jsonError}</p>{/if}
			{:else}
				<label class="mt-3 flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="accent-accent"
						bind:checked={replace}
						onchange={() => (dirty = true)}
						disabled={!inBuiltIns}
					/>
					Replace the default entries (unticked: add to them)
				</label>
				<div
					class="mt-2 grid grid-cols-[1fr_4rem_1fr_6rem_2rem] items-center gap-1 text-xs text-ink-muted"
				>
					<span>Value</span><span>Weight</span><span>Condition</span><span>Tags</span><span></span>
				</div>
				<div class="max-h-[26rem] overflow-y-auto">
					{#each rows as row, i (i)}
						<div class="mt-1 grid grid-cols-[1fr_4rem_1fr_6rem_2rem] items-center gap-1" data-entry>
							<input
								class="rounded border border-border bg-surface px-2 py-1 text-sm"
								bind:value={row.v}
								oninput={() => (dirty = true)}
								aria-label="Value {i + 1}"
							/>
							<input
								class="rounded border border-border bg-surface px-2 py-1 text-sm"
								bind:value={row.w}
								oninput={() => (dirty = true)}
								aria-label="Weight {i + 1}"
								placeholder="1"
							/>
							<input
								class="rounded border border-border bg-surface px-2 py-1 font-mono text-xs"
								bind:value={row.when}
								oninput={() => (dirty = true)}
								aria-label="Condition {i + 1}"
								placeholder="tone: dark; gender: f"
							/>
							<input
								class="rounded border border-border bg-surface px-2 py-1 text-xs"
								bind:value={row.tags}
								oninput={() => (dirty = true)}
								aria-label="Tags {i + 1}"
							/>
							<button
								type="button"
								class="rounded p-1 text-ink-muted hover:bg-surface-3"
								aria-label="Remove entry {i + 1}"
								onclick={() => removeRow(i)}><Trash2 size={14} aria-hidden="true" /></button
							>
						</div>
					{/each}
				</div>
				<button
					type="button"
					class="mt-2 flex items-center gap-1 rounded border border-border px-2 py-1 text-sm hover:bg-surface-3"
					onclick={addRow}><Plus size={14} aria-hidden="true" /> Add entry</button
				>
				<p class="mt-2 text-xs text-ink-muted">
					Values may use {'{table}'} tokens and $g, $sex, $culture, $alt variables. Conditions: preset,
					tone, gender, ancestry, archetype, role, tier, age.
				</p>
			{/if}
		{/if}
	</div>
</div>
