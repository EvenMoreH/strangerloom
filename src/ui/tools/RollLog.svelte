<script lang="ts">
	import { rolls } from '../../data/rolls.svelte';
	import { ROLL_LOG_SIZE } from '../../engine/dice';

	const time = (at: number) =>
		new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
</script>

<section class="rounded-lg border border-border bg-surface p-3" aria-labelledby="roll-log-title">
	<div class="flex items-center gap-2">
		<h2 id="roll-log-title" class="text-xs font-medium tracking-wide text-ink-muted uppercase">
			Roll log
		</h2>
		<span class="text-xs text-ink-muted">last {ROLL_LOG_SIZE}</span>
		{#if rolls.entries.length}
			<button
				type="button"
				class="ml-auto rounded px-2 py-1 text-xs hover:bg-surface-3"
				onclick={() => rolls.clear()}>Clear</button
			>
		{/if}
	</div>
	{#if rolls.entries.length === 0}
		<p class="mt-2 text-sm text-ink-muted">Nothing rolled yet.</p>
	{:else}
		<ol class="mt-2 divide-y divide-border text-sm" aria-live="polite">
			{#each rolls.entries as e (e.id)}
				<li class="flex flex-wrap items-baseline gap-x-3 py-1.5">
					<span class="w-12 text-xs text-ink-muted">{time(e.at)}</span>
					{#if e.label}<span class="font-medium">{e.label}</span>{/if}
					<span class="font-mono text-ink-muted">{e.expression}</span>
					<span class="font-mono">{e.breakdown}</span>
				</li>
			{/each}
		</ol>
	{/if}
</section>
