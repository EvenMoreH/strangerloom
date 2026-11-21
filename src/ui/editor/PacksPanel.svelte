<script lang="ts">
	import { Download, Trash2, Upload } from '@lucide/svelte';
	import { packs } from '../../data/packs.svelte';
	import { downloadText } from '../library/download';

	let { onnotice }: { onnotice: (text: string) => void } = $props();
	let confirmReset = $state(false);
	let error = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	function exportOne(kind: 'tables' | 'adapter', id: string) {
		const json = packs.packJson(kind, id);
		if (!json) return;
		downloadText(`strangerloom-${kind}-${id}.json`, json);
		onnotice('Pack saved as a file');
	}
	function exportAll() {
		const day = new Date().toISOString().slice(0, 10);
		downloadText(`strangerloom-packs-${day}.json`, packs.allJson());
		onnotice('All customisations saved as a file');
	}
	async function importFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const n = await packs.importJson(await file.text());
			error = '';
			onnotice(`Imported ${n} pack${n === 1 ? '' : 's'}`);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
		input.value = '';
	}
	async function resetAll() {
		await packs.resetAll();
		confirmReset = false;
		onnotice('Everything is back to default');
	}
</script>

<div class="flex flex-wrap gap-2">
	<button
		type="button"
		class="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
		onclick={() => fileInput?.click()}
	>
		<Upload size={16} aria-hidden="true" /> Import pack or backup
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept="application/json,.json"
		class="hidden"
		aria-label="Import pack file"
		onchange={importFile}
	/>
	<button
		type="button"
		class="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3 disabled:opacity-50"
		disabled={!packs.list.length}
		onclick={exportAll}
	>
		<Download size={16} aria-hidden="true" /> Export all customisations
	</button>
	<div class="ml-auto flex items-center gap-2">
		{#if confirmReset}
			<span class="text-sm">Remove every pack of yours?</span>
			<button
				type="button"
				class="rounded bg-danger px-3 py-1.5 text-sm text-white"
				onclick={resetAll}>Yes, revert everything</button
			>
			<button
				type="button"
				class="rounded border border-border px-3 py-1.5 text-sm"
				onclick={() => (confirmReset = false)}>Cancel</button
			>
		{:else}
			<button
				type="button"
				class="rounded border border-border px-3 py-1.5 text-sm text-danger hover:bg-surface-3 disabled:opacity-50"
				disabled={!packs.list.length}
				onclick={() => (confirmReset = true)}>Revert everything to default</button
			>
		{/if}
	</div>
</div>
{#if error}<p class="mt-2 text-sm text-danger" role="alert">{error}</p>{/if}
<p class="mt-2 text-sm text-ink-muted">
	A pack file holds one table pack or one adapter and can be imported on its own. The library backup
	carries every pack of yours as well.
</p>

{#if !packs.list.length}
	<p class="mt-4 text-sm text-ink-muted">
		No packs of yours yet. Customise a table or an adapter, or import a pack.
	</p>
{:else}
	<ul class="mt-4 divide-y divide-border rounded border border-border" aria-label="Your packs">
		{#each packs.list as p (p.kind + ':' + p.pack.id)}
			<li class="flex flex-wrap items-center gap-3 px-3 py-2" data-pack>
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="accent-accent"
						checked={p.enabled}
						onchange={(e) => packs.setEnabled(p.kind, p.pack.id, e.currentTarget.checked)}
						aria-label="Enable {p.pack.name}"
					/>
					<span class="font-medium">{p.pack.name}</span>
				</label>
				<span class="font-mono text-xs text-ink-muted">{p.kind}:{p.pack.id} v{p.pack.version}</span>
				<span class="text-xs text-ink-muted">
					{p.kind === 'tables'
						? `${Object.keys(p.pack.tables).length} table${Object.keys(p.pack.tables).length === 1 ? '' : 's'}`
						: 'adapter'}
				</span>
				<div class="ml-auto flex gap-1">
					<button
						type="button"
						class="rounded p-2 text-ink-muted hover:bg-surface-3"
						aria-label="Export {p.pack.name}"
						onclick={() => exportOne(p.kind, p.pack.id)}
						><Download size={16} aria-hidden="true" /></button
					>
					<button
						type="button"
						class="rounded p-2 text-ink-muted hover:bg-surface-3"
						aria-label="Delete {p.pack.name}"
						onclick={() => packs.remove(p.kind, p.pack.id).then(() => onnotice('Pack removed'))}
						><Trash2 size={16} aria-hidden="true" /></button
					>
				</div>
			</li>
		{/each}
	</ul>
{/if}
