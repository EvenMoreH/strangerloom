<script lang="ts">
	import AdaptersEditor from './AdaptersEditor.svelte';
	import PacksPanel from './PacksPanel.svelte';
	import TablesEditor from './TablesEditor.svelte';

	type Tab = 'tables' | 'adapters' | 'packs';
	const tabs: { id: Tab; label: string }[] = [
		{ id: 'tables', label: 'Tables' },
		{ id: 'adapters', label: 'Adapters' },
		{ id: 'packs', label: 'Packs' }
	];
	let tab = $state<Tab>('tables');
	let message = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	function say(text: string) {
		message = text;
		clearTimeout(timer);
		timer = setTimeout(() => (message = ''), 3000);
	}
</script>

<section class="mx-auto max-w-5xl p-4" aria-labelledby="editor-title">
	<div class="flex flex-wrap items-center gap-3">
		<h1 id="editor-title" class="text-xl font-semibold">Editor</h1>
		<div class="flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Editor section">
			{#each tabs as t (t.id)}
				<button
					type="button"
					role="tab"
					aria-selected={tab === t.id}
					class="rounded-md px-3 py-1.5 text-sm text-ink-muted aria-selected:bg-surface aria-selected:font-medium aria-selected:text-ink aria-selected:shadow-sm"
					onclick={() => (tab = t.id)}
				>
					{t.label}
				</button>
			{/each}
		</div>
		<p class="ml-auto min-h-5 text-sm text-ink-muted" role="status">{message}</p>
	</div>
	<p class="mt-2 text-sm text-ink-muted">
		Built-in content never changes. What you customise is kept as your own packs, can be switched
		off, exported and imported, and reverting removes your copy so the default is back.
	</p>

	<div class="mt-4">
		{#if tab === 'tables'}
			<TablesEditor onnotice={say} />
		{:else if tab === 'adapters'}
			<AdaptersEditor onnotice={say} />
		{:else}
			<PacksPanel onnotice={say} />
		{/if}
	</div>
</section>
