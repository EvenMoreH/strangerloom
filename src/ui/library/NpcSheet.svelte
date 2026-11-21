<script lang="ts">
	import type { StatBlock as Block } from '../../engine/adapter';
	import type { Npc } from '../../engine/schema';
	import { prefs } from '../../data/prefs.svelte';
	import { blurbLine, displayField, NARRATIVE_ROWS } from '../generate/display';
	import StatBlock from '../statblock/StatBlock.svelte';

	let {
		npc,
		block,
		preset,
		compact = false,
		heading = 'h2'
	}: {
		npc: Npc;
		block: Block | null;
		/** The preset of the record's recipe, for the culture frame. */
		preset: string;
		compact?: boolean;
		heading?: 'h2' | 'h3';
	} = $props();

	const n = $derived(npc.narrative);
	const rows = $derived(NARRATIVE_ROWS.filter(([f]) => !prefs.isHidden(f)));
</script>

<header class="mb-3">
	<div class="flex flex-wrap items-baseline gap-x-3">
		<svelte:element this={heading} class="text-2xl font-semibold wrap-break-word"
			>{n.name.full}</svelte:element
		>
		{#if !prefs.isHidden('pronouns')}<span class="text-ink-muted">{n.pronouns}</span>{/if}
	</div>
	<p class="min-h-5 text-sm text-ink-muted">{blurbLine(n, (f) => prefs.isHidden(f), preset)}</p>
</header>
<dl class="divide-y divide-border">
	{#each rows as [field, label] (field)}
		<div class="flex flex-col px-2 py-1.5 sm:flex-row sm:gap-2" data-field={field}>
			<dt
				class="w-24 shrink-0 pt-0.5 text-xs font-medium tracking-wide text-ink-muted uppercase sm:w-28"
			>
				{label}
			</dt>
			<dd class="min-w-0 flex-1 wrap-break-word">{displayField(n, field, preset)}</dd>
		</div>
	{/each}
</dl>
{#if block}
	<div class="mt-4">
		<StatBlock {block} {compact} controls={false} />
	</div>
{/if}
