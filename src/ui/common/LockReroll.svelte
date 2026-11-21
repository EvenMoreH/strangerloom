<script lang="ts">
	import { Lock, LockOpen, RefreshCw } from '@lucide/svelte';

	let {
		label,
		locked,
		onreroll,
		ontogglelock,
		size = 16
	}: {
		label: string;
		locked: boolean;
		onreroll: () => void;
		ontogglelock: () => void;
		size?: number;
	} = $props();
</script>

<button
	type="button"
	class="rounded p-1.5 hover:bg-surface-3 aria-pressed:text-accent"
	aria-pressed={locked}
	aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
	title={locked ? 'Unlock (L)' : 'Lock (L)'}
	onclick={ontogglelock}
>
	{#if locked}<Lock {size} aria-hidden="true" />{:else}<LockOpen {size} aria-hidden="true" />{/if}
</button>
<button
	type="button"
	class="rounded p-1.5 hover:bg-surface-3"
	aria-label={`Reroll ${label}`}
	title="Reroll (R)"
	onclick={onreroll}
>
	<RefreshCw {size} aria-hidden="true" />
</button>
