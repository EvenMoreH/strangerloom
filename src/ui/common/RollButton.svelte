<script lang="ts">
	import { Dices } from '@lucide/svelte';

	let {
		roll,
		label,
		onroll,
		size = 14
	}: {
		roll: string;
		label: string;
		onroll: (roll: string, label: string) => void;
		size?: number;
	} = $props();
</script>

<button
	type="button"
	class="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs hover:border-border-strong hover:bg-surface-3"
	aria-label={`Roll ${label}: ${roll}`}
	title="Roll (Enter)"
	data-roll={roll}
	onclick={() => onroll(roll, label)}
>
	<Dices {size} aria-hidden="true" />
	{roll}
</button>
