<script lang="ts">
	import { Dices } from '@lucide/svelte';
	import { rolls } from '../../data/rolls.svelte';
	import { DiceError, type RollLogEntry } from '../../engine/dice';

	let expression = $state('1d20');
	let error = $state('');
	let last = $state<RollLogEntry | null>(null);

	const quick = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100', '4d6kh3', '2d20kh1'];

	function doRoll(expr = expression) {
		try {
			last = rolls.roll(expr);
			expression = last.expression;
			error = '';
		} catch (err) {
			error = err instanceof DiceError ? err.message : String(err);
		}
	}
</script>

<section class="rounded-lg border border-border bg-surface p-3" aria-labelledby="dice-title">
	<h2 id="dice-title" class="text-xs font-medium tracking-wide text-ink-muted uppercase">
		Dice roller
	</h2>
	<form
		class="mt-2 flex flex-wrap items-center gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			doRoll();
		}}
	>
		<input
			class="w-40 rounded border border-border bg-surface px-2 py-1.5 font-mono"
			class:border-danger={!!error}
			aria-invalid={!!error}
			aria-label="Dice expression"
			aria-describedby="dice-help"
			bind:value={expression}
			spellcheck="false"
			autocomplete="off"
		/>
		<button
			type="submit"
			class="flex items-center gap-2 rounded-md bg-accent-fill px-4 py-2 font-medium text-accent-ink glow hover:opacity-90"
		>
			<Dices size={18} aria-hidden="true" />
			Roll
		</button>
	</form>
	<output
		class="mt-2 flex min-h-9 flex-wrap items-baseline gap-x-2"
		for="dice-title"
		aria-live="polite"
	>
		{#if last}
			<span class="text-2xl font-semibold tabular-nums" data-total>{last.total}</span>
			<span class="font-mono text-sm text-ink-muted">{last.breakdown}</span>
		{/if}
	</output>
	{#if error}
		<p class="mt-1 text-sm text-danger" role="alert">{error}</p>
	{/if}
	<div class="mt-2 flex flex-wrap gap-1" role="group" aria-label="Quick rolls">
		{#each quick as q (q)}
			<button
				type="button"
				class="min-h-9 rounded border border-border px-2.5 font-mono text-sm hover:bg-surface-3"
				onclick={() => doRoll(q)}>{q}</button
			>
		{/each}
	</div>
	<p id="dice-help" class="mt-2 text-xs text-ink-muted">
		<code>NdM</code>, <code>+</code> and <code>-</code> terms, <code>kh3</code> / <code>kl1</code>
		keep high or low, <code>dh1</code> / <code>dl1</code> drop high or low, <code>!</code> explodes
		on the top face, <code>d%</code> is d100.
	</p>
</section>
