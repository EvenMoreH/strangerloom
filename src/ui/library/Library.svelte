<script lang="ts">
	import { Download, Printer, Search, Star, Swords, Upload, X } from '@lucide/svelte';
	import { library, type Filter } from '../../data/library.svelte';
	import { routeToHash } from '../../data/router.svelte';
	import { prefs } from '../../data/prefs.svelte';
	import type { SavedNpc, SavedParty } from '../../engine/schema';
	import { blurbLine } from '../generate/display';
	import { downloadText } from './download';

	type Tab = 'npcs' | 'parties' | 'roster';
	let tab = $state<Tab>('npcs');
	let query = $state('');
	let favourites = $state(false);
	let tag = $state('');
	let message = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	const filter = $derived<Filter>({ query, favourites, tag });
	const npcs = $derived(library.filterNpcs(filter));
	const parties = $derived(library.filterParties(filter));
	const when = (iso: string) => new Date(iso).toLocaleString();

	function exportBackup() {
		const day = new Date().toISOString().slice(0, 10);
		downloadText(`strangerloom-library-${day}.json`, library.backupJson());
		message = 'Backup saved';
	}

	async function importFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const r = await library.importJson(await file.text());
			const packs = r.packs ? ` and ${r.packs} pack${r.packs === 1 ? '' : 's'}` : '';
			message = `Imported ${r.npcs} NPC${r.npcs === 1 ? '' : 's'} and ${r.parties} part${r.parties === 1 ? 'y' : 'ies'}${packs}${r.remapped ? ` (${r.remapped} given new ids)` : ''}`;
		} catch (err) {
			message = err instanceof Error ? err.message : String(err);
		}
	}

	function printShown() {
		const ids = tab === 'parties' ? parties.map((p) => p.id) : npcs.map((n) => n.id);
		if (!ids.length) return;
		location.hash = routeToHash({
			screen: 'print',
			kind: tab === 'parties' ? 'party' : 'npc',
			ids
		});
	}

	const npcOf = (id: string) => library.npc(id);
	const tabs: [Tab, string, number][] = $derived([
		['npcs', 'NPCs', library.npcs.length],
		['parties', 'Parties', library.parties.length],
		['roster', 'Roster', library.roster.length]
	]);
</script>

{#snippet star(record: SavedNpc | SavedParty)}
	<button
		type="button"
		class="rounded p-2 text-ink-muted hover:bg-surface-3 aria-pressed:text-accent"
		aria-pressed={record.favourite}
		aria-label={record.favourite ? 'Remove from favourites' : 'Add to favourites'}
		onclick={() => library.update(record, { favourite: !record.favourite })}
	>
		<Star size={16} aria-hidden="true" fill={record.favourite ? 'currentColor' : 'none'} />
	</button>
{/snippet}

{#snippet tags(list: string[])}
	{#if list.length}
		<span class="flex flex-wrap gap-1">
			{#each list as t (t)}
				<span class="rounded bg-surface-3 px-1.5 text-xs">{t}</span>
			{/each}
		</span>
	{/if}
{/snippet}

<section class="mx-auto max-w-3xl p-4" aria-labelledby="library-title">
	<div class="flex flex-wrap items-center gap-2">
		<h1 id="library-title" class="text-xl font-semibold">Library</h1>
		<div class="ml-auto flex flex-wrap gap-1">
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
				onclick={() => fileInput?.click()}
			>
				<Upload size={14} aria-hidden="true" /> Import
			</button>
			<input
				bind:this={fileInput}
				type="file"
				accept=".json,application/json"
				class="sr-only"
				aria-label="Import file"
				onchange={importFile}
			/>
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
				onclick={exportBackup}
			>
				<Download size={14} aria-hidden="true" /> Export backup
			</button>
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3 disabled:opacity-50"
				disabled={tab === 'roster' || (tab === 'npcs' ? npcs.length : parties.length) === 0}
				onclick={printShown}
			>
				<Printer size={14} aria-hidden="true" /> Print shown
			</button>
		</div>
	</div>
	<p class="mt-1 flex h-5 items-center text-sm text-ink-muted" role="status" aria-live="polite">
		{message}
	</p>

	<div class="mt-2 flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Library">
		{#each tabs as [id, label, count] (id)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === id}
				class="flex-1 rounded-md px-3 py-1.5 text-sm text-ink-muted aria-selected:bg-surface aria-selected:font-medium aria-selected:text-ink aria-selected:shadow-sm"
				onclick={() => (tab = id)}
			>
				{label} <span class="tabular-nums">({count})</span>
			</button>
		{/each}
	</div>

	{#if tab !== 'roster'}
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<label class="relative min-w-0 flex-1">
				<Search
					size={14}
					aria-hidden="true"
					class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-ink-muted"
				/>
				<input
					type="search"
					class="w-full rounded border border-border bg-surface py-1.5 pr-2 pl-7 text-sm"
					placeholder="Search names, tags, notes, lines"
					aria-label="Search"
					bind:value={query}
				/>
			</label>
			<button
				type="button"
				class="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-sm aria-pressed:bg-surface-3 aria-pressed:font-medium"
				aria-pressed={favourites}
				onclick={() => (favourites = !favourites)}
			>
				<Star size={14} aria-hidden="true" fill={favourites ? 'currentColor' : 'none'} /> Favourites
			</button>
			{#if library.tags.length}
				<select
					class="rounded border border-border bg-surface px-2 py-1.5 text-sm"
					aria-label="Tag"
					bind:value={tag}
				>
					<option value="">Any tag</option>
					{#each library.tags as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>
			{/if}
		</div>
	{/if}

	{#if !library.ready}
		<p class="mt-6 text-center text-ink-muted">Loading…</p>
	{:else if library.error}
		<p class="mt-4 rounded border border-danger p-3 text-danger" role="alert">{library.error}</p>
	{:else if tab === 'npcs'}
		{#if npcs.length === 0}
			<p class="mt-6 text-center text-ink-muted">
				{library.npcs.length === 0
					? 'No saved NPCs yet. Save one from the generate screen.'
					: 'Nothing matches.'}
			</p>
		{:else}
			<ul class="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
				{#each npcs as r (r.id)}
					<li class="flex items-start gap-2 px-3 py-2" data-record={r.id}>
						<a
							href={routeToHash({ screen: 'npc', id: r.id })}
							class="min-w-0 flex-1 hover:underline"
						>
							<span class="font-medium">{r.npc.narrative.name.full}</span>
							{#if r.npc.profile}
								<span
									class="ml-2 inline-flex items-center gap-1 rounded bg-accent-fill px-1.5 align-middle text-xs text-accent-ink"
									data-tier="combat"
								>
									<Swords size={12} aria-hidden="true" /> Combat
								</span>
								<span class="text-sm text-ink-muted"> | {r.npc.profile.archetypeLabel}</span>
							{:else}
								<span
									class="ml-2 rounded border border-border px-1.5 align-middle text-xs text-ink-muted"
									data-tier="flavour">Flavour</span
								>
							{/if}
							<span class="block text-sm text-ink-muted"
								>{blurbLine(r.npc.narrative, (f) => prefs.isHidden(f), r.recipe.preset)}</span
							>
						</a>
						{@render tags(r.tags)}
						<span class="hidden text-xs text-ink-muted tabular-nums sm:block"
							>{when(r.updatedAt)}</span
						>
						{@render star(r)}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if tab === 'parties'}
		{#if parties.length === 0}
			<p class="mt-6 text-center text-ink-muted">
				{library.parties.length === 0
					? 'No saved parties yet. Save one from the Party tab.'
					: 'Nothing matches.'}
			</p>
		{:else}
			<ul class="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
				{#each parties as r (r.id)}
					<li class="flex items-start gap-2 px-3 py-2" data-record={r.id}>
						<a
							href={routeToHash({ screen: 'party', id: r.id })}
							class="min-w-0 flex-1 hover:underline"
						>
							<span class="font-medium">{r.party.name}</span>
							<span class="block text-sm text-ink-muted">
								{r.party.members.length} members | {r.party.members
									.map((m) => m.narrative.name.given)
									.join(', ')}
							</span>
						</a>
						{@render tags(r.tags)}
						<span class="hidden text-xs text-ink-muted tabular-nums sm:block"
							>{when(r.updatedAt)}</span
						>
						{@render star(r)}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if library.roster.length === 0}
		<p class="mt-6 text-center text-ink-muted">
			The roster lists the NPCs the players met this session. Add one from a saved NPC.
		</p>
	{:else}
		<ol class="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
			{#each library.roster as e, i (e.id)}
				{@const npc = npcOf(e.npcId)}
				<li class="flex items-center gap-2 px-3 py-2" data-roster={e.id}>
					<span class="w-6 text-right text-sm text-ink-muted tabular-nums">{i + 1}.</span>
					<div class="min-w-0 flex-1">
						{#if npc}
							<a
								href={routeToHash({ screen: 'npc', id: npc.id })}
								class="font-medium hover:underline">{npc.npc.narrative.name.full}</a
							>
						{:else}
							<span class="text-ink-muted">(deleted NPC)</span>
						{/if}
						<input
							class="mt-0.5 block w-full rounded border border-transparent bg-transparent px-1 text-sm hover:border-border focus:border-border"
							aria-label="Roster label"
							placeholder="Where or how they met"
							value={e.label}
							onchange={(ev) => library.relabelRoster(e, ev.currentTarget.value)}
						/>
					</div>
					<span class="hidden text-xs text-ink-muted tabular-nums sm:block">{when(e.at)}</span>
					<button
						type="button"
						class="rounded p-2 text-ink-muted hover:bg-surface-3"
						aria-label="Remove from roster"
						onclick={() => library.removeFromRoster(e.id)}
					>
						<X size={16} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ol>
		<div class="mt-2 flex justify-end">
			<button
				type="button"
				class="rounded px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-3"
				onclick={() => library.clearRoster()}>Clear roster</button
			>
		</div>
	{/if}
</section>
