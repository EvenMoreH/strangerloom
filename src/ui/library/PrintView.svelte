<script lang="ts">
	import type { ChronicleEntry } from '../../engine/schema';
	import { onMount } from 'svelte';
	import { Printer } from '@lucide/svelte';
	import { library } from '../../data/library.svelte';
	import { routeToHash } from '../../data/router.svelte';
	import { memberOrder } from '../../engine/party';
	import type { SavedNpc, SavedParty } from '../../engine/schema';
	import NpcSheet from './NpcSheet.svelte';
	import { blockOf } from './render';

	let { kind, ids }: { kind: 'npc' | 'party'; ids: string[] } = $props();

	const npcs = $derived(
		kind === 'npc' ? ids.map((id) => library.npc(id)).filter((r): r is SavedNpc => !!r) : []
	);
	const parties = $derived(
		kind === 'party' ? ids.map((id) => library.party(id)).filter((r): r is SavedParty => !!r) : []
	);
	const count = $derived(npcs.length + parties.length);

	onMount(() => {
		// Open the print dialog once the records are on the page.
		library.whenReady().then(() => setTimeout(() => window.print(), 300));
	});
</script>

<section class="mx-auto max-w-3xl p-4 print:max-w-none print:p-0" aria-labelledby="print-title">
	<div class="mb-3 flex flex-wrap items-center gap-2 print:hidden">
		<a class="text-sm text-ink-muted hover:underline" href={routeToHash({ screen: 'library' })}
			>Library</a
		>
		<span class="text-ink-muted">/</span>
		<h1 id="print-title" class="flex-1 text-lg font-semibold">
			Print {count}
			{kind === 'npc' ? (count === 1 ? 'NPC' : 'NPCs') : count === 1 ? 'party' : 'parties'}
		</h1>
		<button
			type="button"
			class="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-sm hover:bg-surface-3"
			onclick={() => window.print()}
		>
			<Printer size={14} aria-hidden="true" /> Print
		</button>
	</div>
	{#if library.ready && count === 0}
		<p class="text-ink-muted">Nothing to print.</p>
	{/if}
	{#snippet chronicle(entries: ChronicleEntry[])}
		{#if entries.length}
			<h3 class="mt-3 text-xs font-medium tracking-wide text-ink-muted uppercase">Chronicle</h3>
			<ul class="mt-1 text-sm">
				{#each [...entries].sort((a, b) => b.at.localeCompare(a.at)) as e (e.id)}
					<li>
						<span class="text-ink-muted"
							>{new Date(e.at).toLocaleDateString()}{e.label ? `, ${e.label}` : ''}.</span
						>
						{e.text}
					</li>
				{/each}
			</ul>
		{/if}
	{/snippet}
	<div class="space-y-6 print:space-y-0">
		{#each npcs as r (r.id)}
			<article
				class="rounded-lg border border-border bg-surface-2 p-4 print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:pb-6"
				data-print={r.id}
			>
				<NpcSheet
					npc={r.npc}
					block={blockOf(r.npc, r.recipe, r.overrides)}
					preset={r.recipe.preset}
				/>
				{#if r.notes}<p class="mt-3 text-sm italic">{r.notes}</p>{/if}
				{@render chronicle(r.chronicle ?? [])}
			</article>
		{/each}
		{#each parties as r (r.id)}
			{@const p = r.party}
			<article
				class="rounded-lg border border-border bg-surface-2 p-4 print:rounded-none print:border-0 print:p-0"
				data-print={r.id}
			>
				<h2 class="text-2xl font-semibold">{p.name}</h2>
				<p class="text-sm text-ink-muted">
					{p.members.length} members | led by {p.members[p.leaderIndex].narrative.name.full}
				</p>
				<dl class="mt-2 text-sm">
					{#each [['Reputation', p.reputation], ['Goal', p.goal], ['Hook', p.hook], ['Tactics', p.tactics], ['Loot', `${p.loot.pool} | ${p.loot.notable}`]] as [label, value] (label)}
						<div class="flex gap-2 py-0.5">
							<dt class="w-24 shrink-0 text-xs font-medium tracking-wide text-ink-muted uppercase">
								{label}
							</dt>
							<dd>{value}</dd>
						</div>
					{/each}
				</dl>
				<h3 class="mt-3 text-xs font-medium tracking-wide text-ink-muted uppercase">
					Relationships
				</h3>
				<ul class="mt-1 text-sm">
					{#each p.relationships as rel, i (i)}
						<li><span class="capitalize">{rel.kind}</span>: {rel.text}</li>
					{/each}
				</ul>
				{#each memberOrder(p) as i (i)}
					<div class="mt-6 border-t border-border pt-4 print:break-inside-avoid">
						<NpcSheet
							npc={p.members[i]}
							block={blockOf(p.members[i], r.recipe)}
							heading="h3"
							preset={r.recipe.preset}
						/>
					</div>
				{/each}
				{#if r.notes}<p class="mt-3 text-sm italic">{r.notes}</p>{/if}
				{@render chronicle(r.chronicle ?? [])}
			</article>
		{/each}
	</div>
</section>
