<script lang="ts">
	import LockReroll from '../common/LockReroll.svelte';

	let {
		field,
		label,
		value,
		locked,
		onreroll,
		ontogglelock
	}: {
		field: string;
		label: string;
		value: string;
		locked: boolean;
		onreroll: (field: string) => void;
		ontogglelock: (field: string) => void;
	} = $props();
</script>

<div
	class="flex items-start gap-2 rounded px-2 py-1.5 focus-within:bg-surface-3/50"
	data-field={field}
>
	<div class="flex min-w-0 flex-1 flex-col sm:flex-row sm:gap-2">
		<dt
			class="w-24 shrink-0 pt-0.5 text-xs font-medium tracking-wide text-ink-muted uppercase sm:w-28"
		>
			{label}
		</dt>
		<dd class="min-w-0 flex-1 wrap-break-word" class:text-accent={locked}>{value}</dd>
	</div>
	<div class="flex shrink-0 gap-0.5">
		<LockReroll
			{label}
			{locked}
			onreroll={() => onreroll(field)}
			ontogglelock={() => ontogglelock(field)}
		/>
	</div>
</div>
