<script lang="ts">
	import { ChevronDown, ChevronRight, Crown } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { StatBlock as Block } from '../../engine/adapter';
	import type { NarrativeField, Npc, ProfileField } from '../../engine/schema';
	import LockReroll from '../common/LockReroll.svelte';
	import FieldRow from '../generate/FieldRow.svelte';
	import { NARRATIVE_ROWS, blurbLine, displayField, profileLine } from '../generate/display';
	import StatBlock from '../statblock/StatBlock.svelte';
	import { prefs } from '../../data/prefs.svelte';

	let {
		index,
		member,
		preset,
		block,
		leader,
		compact,
		isLocked,
		onreroll,
		ontogglelock,
		onroll,
		actions
	}: {
		index: number;
		member: Npc;
		/** The preset of the party's recipe, for the culture frame. */
		preset: string;
		block: Block | null;
		leader: boolean;
		compact: boolean;
		/** `field` undefined means the whole member. */
		isLocked: (field?: NarrativeField | ProfileField) => boolean;
		onreroll: (field?: NarrativeField | ProfileField) => void;
		ontogglelock: (field?: NarrativeField | ProfileField) => void;
		onroll?: (roll: string, label: string) => void;
		/** Extra controls after the lock and reroll: the member's actions menu. */
		actions?: Snippet;
	} = $props();

	let open = $state(false);
	const narrative = $derived(member.narrative);
	const profile = $derived(member.profile);
	const rows = $derived(NARRATIVE_ROWS.filter(([f]) => !prefs.isHidden(f)));
</script>

<li
	class="rounded-lg border border-border bg-surface"
	data-member={index}
	data-member-open={open ? '' : undefined}
>
	<div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 p-2" data-field="member">
		<button
			type="button"
			class="mt-0.5 rounded p-1 hover:bg-surface-3"
			aria-expanded={open}
			aria-label={open ? `Collapse ${narrative.name.full}` : `Expand ${narrative.name.full}`}
			onclick={() => (open = !open)}
		>
			{#if open}<ChevronDown size={16} aria-hidden="true" />{:else}<ChevronRight
					size={16}
					aria-hidden="true"
				/>{/if}
		</button>
		<div class="min-w-0">
			<p class="flex flex-wrap items-baseline gap-x-2">
				<strong class="wrap-break-word" class:text-accent={isLocked()} data-member-name
					>{narrative.name.full}</strong
				>
				{#if leader}
					<span
						class="flex items-center gap-1 rounded bg-surface-3 px-1.5 text-xs font-medium"
						data-leader
					>
						<Crown size={12} aria-hidden="true" /> Leader
					</span>
				{/if}
			</p>
		</div>
		<div class="flex gap-0.5">
			<LockReroll
				label={`member ${narrative.name.full}`}
				locked={isLocked()}
				onreroll={() => onreroll()}
				ontogglelock={() => ontogglelock()}
				size={14}
			/>
			{@render actions?.()}
		</div>
		<!-- The summary starts under the name and runs under the buttons too. -->
		<p class="col-span-2 col-start-2 min-h-5 text-sm text-ink-muted">
			{#if profile}{`${profileLine(member)} | `}
			{/if}{blurbLine(narrative, (f) => prefs.isHidden(f), preset)}
		</p>
	</div>
	{#if open}
		<div class="border-t border-border p-2">
			<dl class="divide-y divide-border">
				{#each rows as [field, label] (field)}
					<FieldRow
						{field}
						{label}
						value={displayField(narrative, field, preset)}
						locked={isLocked(field)}
						onreroll={(f) => onreroll(f as NarrativeField)}
						ontogglelock={(f) => ontogglelock(f as NarrativeField)}
					/>
				{/each}
			</dl>
			{#if block}
				<div class="mt-3">
					<StatBlock
						{block}
						{compact}
						isLocked={(f) => isLocked(f)}
						onreroll={(f) => onreroll(f)}
						ontogglelock={(f) => ontogglelock(f)}
						{onroll}
					/>
				</div>
			{/if}
		</div>
	{/if}
</li>
