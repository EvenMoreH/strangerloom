<script lang="ts">
	import { BUILT_IN_ADAPTERS, PRESETS } from '../../content';
	import { packs } from '../../data/packs.svelte';
	import { renderAdapter } from '../../engine/adapter';
	import { generateNpc } from '../../engine/npc';
	import { checkAdapterPack, cloneAdapter } from '../../engine/packs';
	import { newRecipe } from '../../engine/recipe';
	import { SLUG, type AdapterPack, type Npc } from '../../engine/schema';
	import { downloadText } from '../library/download';
	import StatBlock from '../statblock/StatBlock.svelte';

	let { onnotice }: { onnotice: (text: string) => void } = $props();

	const SAMPLE_SEEDS = ['7KQ2M9XA', 'B3N8RT5C', 'ZZZZZZZZ'];

	let presetId = $state(PRESETS.presets[0].id);
	let selectedId = $state<string>(BUILT_IN_ADAPTERS[0].id);
	let text = $state('');
	let editing = $state(false);
	let dirty = $state(false);
	let newId = $state('');
	let newName = $state('');
	let cloning = $state(false);
	let saveError = $state('');

	interface Row {
		id: string;
		name: string;
		source: 'builtin' | 'custom' | 'user';
	}
	const rows = $derived<Row[]>([
		...BUILT_IN_ADAPTERS.map((a) => {
			const user = packs.find('adapter', a.id);
			return user
				? { id: a.id, name: user.pack.name, source: 'custom' as const }
				: { id: a.id, name: a.name, source: 'builtin' as const };
		}),
		...packs.adapterPacks
			.filter((p) => !BUILT_IN_ADAPTERS.some((a) => a.id === p.pack.id))
			.map((p) => ({ id: p.pack.id, name: p.pack.name, source: 'user' as const }))
	]);
	const row = $derived(rows.find((r) => r.id === selectedId) ?? rows[0]);
	const userPack = $derived(packs.find('adapter', row.id));
	/** What is shown when not editing: the user copy, else the built-in. */
	const current = $derived<AdapterPack>(
		userPack?.kind === 'adapter' ? userPack.pack : BUILT_IN_ADAPTERS.find((a) => a.id === row.id)!
	);
	const preset = $derived(PRESETS.presets.find((p) => p.id === presetId) ?? PRESETS.presets[0]);
	const samples = $derived.by<Npc[]>(() => {
		const catalog = packs.catalogFor(presetId);
		return SAMPLE_SEEDS.map(
			(seed) => generateNpc(newRecipe({ tier: 2, preset: presetId, seed }), catalog).value
		);
	});
	/** The draft while editing: parsed JSON checked against the samples. */
	const draft = $derived.by<{ pack?: AdapterPack; errors: string[] }>(() => {
		if (!editing) return { pack: current, errors: [] };
		let data: unknown;
		try {
			data = JSON.parse(text);
		} catch {
			return { errors: ['This is not JSON.'] };
		}
		return checkAdapterPack(data, samples, preset.damageAnchors);
	});
	const preview = $derived.by(() => {
		if (!draft.pack || draft.errors.length) return null;
		try {
			return renderAdapter(draft.pack, samples[0], { anchors: preset.damageAnchors });
		} catch {
			return null;
		}
	});

	function select(id: string) {
		selectedId = id;
		editing = false;
		dirty = false;
		cloning = false;
		saveError = '';
	}
	/** Opens the editor on a copy of what is shown. For a built-in, saving makes the user copy. */
	function edit() {
		text = JSON.stringify(current, null, 2);
		editing = true;
		dirty = false;
		saveError = '';
	}
	async function save() {
		if (!draft.pack || draft.errors.length) return;
		if (draft.pack.id !== row.id) {
			saveError = `The id must stay "${row.id}". Use Duplicate to make an adapter under another id.`;
			return;
		}
		const wasBuiltIn = row.source === 'builtin';
		try {
			await packs.saveAdapter(draft.pack);
			editing = false;
			dirty = false;
			onnotice(wasBuiltIn ? 'Adapter customised' : 'Adapter saved');
		} catch (err) {
			saveError = err instanceof Error ? err.message : String(err);
		}
	}
	async function revert() {
		const wasOwn = row.source === 'user';
		await packs.remove('adapter', row.id);
		editing = false;
		onnotice(wasOwn ? 'Adapter deleted' : 'Back to default');
		if (!rows.some((r) => r.id === selectedId)) selectedId = rows[0].id;
	}
	async function duplicate() {
		const id = newId.trim().toLowerCase();
		if (!SLUG.test(id) || id === 'generic') {
			saveError = 'An adapter id uses lower-case letters, digits and dashes, like "my-system".';
			return;
		}
		if (rows.some((r) => r.id === id)) {
			saveError = `"${id}" is taken.`;
			return;
		}
		const base = draft.pack && !draft.errors.length ? draft.pack : current;
		await packs.saveAdapter(cloneAdapter(base, id, newName.trim() || id));
		cloning = false;
		newId = '';
		newName = '';
		saveError = '';
		onnotice('Adapter duplicated');
		select(id);
	}
	function exportFile() {
		downloadText(`strangerloom-adapter-${row.id}.json`, JSON.stringify(current, null, 2));
		onnotice('Adapter saved as a file');
	}
</script>

<div class="grid gap-4 md:grid-cols-[14rem_1fr]">
	<div>
		<ul class="rounded border border-border" aria-label="Adapters">
			{#each rows as r (r.id)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2 aria-pressed:bg-surface-3"
						aria-pressed={row.id === r.id}
						onclick={() => select(r.id)}
					>
						<span class="flex-1 truncate">{r.name}</span>
						{#if r.source !== 'builtin'}
							<span class="rounded bg-accent-fill px-1.5 text-[10px] text-accent-ink uppercase"
								>{r.source === 'custom' ? 'customised' : 'own'}</span
							>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		<label class="mt-3 flex flex-col gap-1 text-sm">
			<span class="text-ink-muted">Preview setting</span>
			<select class="rounded border border-border bg-surface px-2 py-1.5" bind:value={presetId}>
				{#each PRESETS.presets as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
		</label>
	</div>

	<div>
		<div class="flex flex-wrap items-center gap-2">
			<h2 class="font-semibold">{current.name}</h2>
			<span class="font-mono text-xs text-ink-muted">{row.id} v{current.version}</span>
			<div class="ml-auto flex flex-wrap gap-1">
				{#if editing}
					<button
						type="button"
						class="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
						onclick={() => (editing = false)}>Cancel</button
					>
					<button
						type="button"
						class="rounded bg-accent-fill px-3 py-1.5 text-sm text-accent-ink glow disabled:opacity-50"
						disabled={!draft.pack || draft.errors.length > 0}
						onclick={save}>Save</button
					>
				{:else}
					<button
						type="button"
						class="rounded bg-accent-fill px-3 py-1.5 text-sm text-accent-ink glow"
						onclick={edit}>{row.source === 'builtin' ? 'Customise' : 'Edit'}</button
					>
					<button
						type="button"
						class="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
						onclick={() => (cloning = !cloning)}>Duplicate</button
					>
					<button
						type="button"
						class="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
						onclick={exportFile}>Export</button
					>
					{#if row.source !== 'builtin'}
						<button
							type="button"
							class="rounded border border-border px-3 py-1.5 text-sm text-danger hover:bg-surface-3"
							onclick={revert}>{row.source === 'custom' ? 'Revert to default' : 'Delete'}</button
						>
					{/if}
				{/if}
			</div>
		</div>

		{#if cloning}
			<form
				class="mt-2 flex flex-wrap items-end gap-2 rounded border border-border p-2"
				onsubmit={(e) => (e.preventDefault(), duplicate())}
			>
				<label class="flex flex-col gap-1 text-sm"
					><span class="text-ink-muted">New id</span><input
						class="rounded border border-border bg-surface px-2 py-1 font-mono text-sm"
						bind:value={newId}
						placeholder="my-system"
					/></label
				>
				<label class="flex flex-col gap-1 text-sm"
					><span class="text-ink-muted">Name</span><input
						class="rounded border border-border bg-surface px-2 py-1 text-sm"
						bind:value={newName}
						placeholder="My system"
					/></label
				>
				<button
					type="submit"
					class="rounded bg-accent-fill px-3 py-1.5 text-sm text-accent-ink glow"
					>Create copy</button
				>
			</form>
		{/if}
		{#if saveError}<p class="mt-2 text-sm text-danger" role="alert">{saveError}</p>{/if}

		<div class="mt-3 grid gap-3 lg:grid-cols-2">
			{#if editing}
				<div>
					<textarea
						class="h-[32rem] w-full rounded border border-border bg-surface p-2 font-mono text-xs"
						bind:value={text}
						oninput={() => (dirty = true)}
						aria-label="Adapter JSON"
						spellcheck="false"></textarea>
					{#if draft.errors.length}
						<ul class="mt-1 rounded border border-danger p-2 text-sm text-danger" role="alert">
							{#each draft.errors as e, i (i)}<li>{e}</li>{/each}
						</ul>
					{:else}
						<p class="mt-1 text-sm text-ink-muted">
							Valid. Renders every sample NPC.{dirty ? ' Unsaved changes.' : ''}
						</p>
					{/if}
				</div>
			{:else}
				<pre
					class="h-[32rem] overflow-auto rounded border border-border bg-surface-2 p-2 font-mono text-xs">{JSON.stringify(
						current,
						null,
						2
					)}</pre>
			{/if}
			<div>
				<p class="mb-1 text-xs tracking-wide text-ink-muted uppercase">Preview</p>
				{#if preview}
					<div class="rounded border border-border bg-surface p-3" data-adapter-preview>
						<StatBlock block={preview} controls={false} />
					</div>
				{:else}
					<p class="text-sm text-ink-muted">No preview until the adapter is valid.</p>
				{/if}
			</div>
		</div>
	</div>
</div>
