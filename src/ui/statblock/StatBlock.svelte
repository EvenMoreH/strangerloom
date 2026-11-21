<script lang="ts">
	import { Pencil, RotateCcw } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { StatBlock, StatLine } from '../../engine/adapter';
	import type { ProfileField } from '../../engine/schema';
	import LockReroll from '../common/LockReroll.svelte';
	import RollButton from '../common/RollButton.svelte';

	let {
		block,
		compact = false,
		controls = true,
		isLocked = () => false,
		onreroll = () => {},
		ontogglelock = () => {},
		onroll,
		onoverride
	}: {
		block: StatBlock;
		compact?: boolean;
		/** Without controls the block is read-only: no locks, rerolls or edits (library and print views). */
		controls?: boolean;
		isLocked?: (field: ProfileField) => boolean;
		onreroll?: (field: ProfileField) => void;
		ontogglelock?: (field: ProfileField) => void;
		/** Called with a dice string when a roll button is pressed. Without it, rolls are shown as text. */
		onroll?: (roll: string, label: string) => void;
		/** Called with a line id and the GM's text, or null to drop the override. Without it, lines are not editable. */
		onoverride?: (lineId: string, value: string | null) => void;
	} = $props();

	let editing = $state<string | null>(null);
	let draft = $state('');

	function startEdit(line: { id: string; value: string }) {
		editing = line.id;
		draft = line.value;
	}
	function commitEdit() {
		if (editing === null) return;
		onoverride?.(editing, draft);
		editing = null;
	}
	function cancelEdit() {
		editing = null;
	}
	function onEditKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		}
	}
	function focus(el: HTMLInputElement) {
		el.focus();
		el.select();
	}

	const rollLabel = (line: { label?: string; id: string }) => line.label ?? line.id;

	/** The profile fields each section's controls act on. */
	const CONTROLS: Record<string, [ProfileField, string][]> = {
		header: [
			['archetype', 'Archetype'],
			['defence', 'Defence']
		],
		competencies: [['competencies', 'Competencies']],
		offence: [['attacks', 'Attacks']],
		abilities: [['abilities', 'Abilities']],
		gear: [
			['gear', 'Gear'],
			['loot', 'Loot']
		],
		tactics: [['tactics', 'Tactics']]
	};

	const section = (id: string) => block.sections.find((s) => s.id === id);

	/**
	 * Compact view: a name with a description is a button with a dotted accent underline. Tapping it pins the
	 * description into the layout; on devices with a pointer, hovering the entry floats it in a popover above the
	 * name, so nothing moves and the pointer never covers the text (Tailwind's hover variants only apply where
	 * hovering is possible).
	 */
	const HINT =
		'cursor-help rounded underline decoration-accent decoration-dotted underline-offset-2 hover:bg-surface-3 aria-expanded:bg-surface-3';
	const revealed = new SvelteSet<string>();
	function toggleReveal(id: string) {
		if (revealed.has(id)) revealed.delete(id);
		else revealed.add(id);
	}
</script>

{#snippet reveal(line: StatLine, inline: boolean)}
	<!-- Hover: a popover above the name that takes no room. Tap: the same text pinned into the layout. -->
	<span
		role="tooltip"
		class="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden w-max max-w-xs rounded border border-border bg-surface p-2 text-xs text-ink shadow-md {revealed.has(
			line.id
		)
			? ''
			: 'group-hover:block'}">{line.note}</span
	>
	{#if inline}
		<span class="text-ink-muted" class:hidden={!revealed.has(line.id)} data-reveal={line.id}
			>({line.note})</span
		>
	{:else}
		<p
			class="pl-4 text-xs text-ink-muted"
			class:hidden={!revealed.has(line.id)}
			data-reveal={line.id}
		>
			{line.note}
		</p>
	{/if}
{/snippet}

{#if compact}
	<div class="rounded-lg border border-border bg-surface p-3 text-sm" data-view="compact">
		<p class="font-medium">{block.subtitle}</p>
		{#if section('header')}
			<p class="text-ink-muted">
				{section('header')!
					.lines.filter((l) => l.id !== 'archetype' && l.id !== 'threat')
					.map((l) => `${l.label}: ${l.value}`)
					.join(' | ')}
			</p>
		{/if}
		{#if section('competencies')}
			<p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
				{#each section('competencies')!.lines as line (line.id)}
					<span class="group relative">
						{#if line.note}
							<button
								type="button"
								class="text-ink-muted {HINT}"
								aria-expanded={revealed.has(line.id)}
								onclick={() => toggleReveal(line.id)}>{line.label}</button
							>
						{:else}
							<span class="text-ink-muted">{line.label}</span>
						{/if}
						<span class="font-mono">{line.value}</span>
						{#if line.note}
							{@render reveal(line, true)}
						{/if}
					</span>
				{/each}
			</p>
		{/if}
		{#each block.sections.filter((s) => s.id !== 'header' && s.id !== 'competencies' && s.id !== 'offence' && s.id !== 'abilities' && s.id !== 'gear' && s.id !== 'tactics') as sec (sec.id)}
			<p class="mt-2">
				{#each sec.lines as line, i (line.id)}
					{#if i > 0}<span class="mx-1 text-ink-muted">|</span>{/if}
					{#if line.label}<span class="text-ink-muted">{line.label}</span>{/if}
					<strong class="ml-1">{line.value}</strong>
					{#if line.roll && onroll}<RollButton
							roll={line.roll}
							label={rollLabel(line)}
							{onroll}
							size={12}
						/>{/if}
				{/each}
			</p>
		{/each}
		{#if section('offence')}
			<ul class="mt-2" aria-label="Attacks">
				{#each section('offence')!.lines as line (line.id)}
					<li class="group relative">
						{#if line.label && line.note}
							<button
								type="button"
								class="mr-1 font-bold {HINT}"
								aria-expanded={revealed.has(line.id)}
								onclick={() => toggleReveal(line.id)}>{line.label}</button
							>
						{:else if line.label}
							<strong class="mr-1">{line.label}</strong>
						{/if}{line.value}
						{#if line.roll && onroll}<RollButton
								roll={line.roll}
								label={rollLabel(line)}
								{onroll}
								size={12}
							/>{/if}
						{#if line.note}
							{@render reveal(line, false)}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if section('abilities') && section('abilities')!.lines.length}
			<ul class="mt-2" aria-label="Abilities">
				{#each section('abilities')!.lines as line (line.id)}
					<li class="group relative">
						{#if line.note}
							<button
								type="button"
								class="mr-1 font-bold {HINT}"
								aria-expanded={revealed.has(line.id)}
								onclick={() => toggleReveal(line.id)}>{line.label}</button
							>
						{:else}
							<strong class="mr-1">{line.label}</strong>
						{/if}<span class="text-ink-muted">({line.value})</span>
						{#if line.note}
							{@render reveal(line, false)}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if section('tactics')}
			<p class="mt-2 italic">{section('tactics')!.lines[0].value}</p>
		{/if}
	</div>
{:else}
	<div class="space-y-3" data-view="full">
		{#each block.sections as sec (sec.id)}
			<section
				class="rounded-lg border border-border bg-surface p-3"
				aria-label={sec.label}
				data-section={sec.id}
			>
				<div class="flex items-center gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink-muted uppercase">{sec.label}</h3>
					{#if sec.note}<p class="text-xs text-ink-muted" data-section-note>{sec.note}</p>{/if}
					<div class="ml-auto flex items-center gap-2">
						{#each controls ? (CONTROLS[sec.id] ?? []) : [] as [field, label] (field)}
							<span class="flex items-center gap-0.5" data-field={field}>
								{#if (CONTROLS[sec.id] ?? []).length > 1}<span class="text-xs text-ink-muted"
										>{label}</span
									>{/if}
								<LockReroll
									{label}
									locked={isLocked(field)}
									onreroll={() => onreroll(field)}
									ontogglelock={() => ontogglelock(field)}
									size={14}
								/>
							</span>
						{/each}
					</div>
				</div>
				<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
					{#each sec.lines as line, i (line.id)}
						{#if line.group && (i === 0 || sec.lines[i - 1].group !== line.group)}
							<dt
								class="col-span-2 pt-1 text-xs font-medium tracking-wide text-ink-muted uppercase"
								class:mt-1={i > 0}
								data-group={line.group}
							>
								{line.group}
							</dt>
						{/if}
						{#if line.label}
							<dt class="text-ink-muted">{line.label}</dt>
						{:else}
							<dt></dt>
						{/if}
						<dd class="flex flex-wrap items-baseline gap-x-2">
							{#if editing === line.id}
								<input
									class="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-0.5"
									aria-label={`${rollLabel(line)} value`}
									bind:value={draft}
									onkeydown={onEditKey}
									onblur={commitEdit}
									use:focus
								/>
							{:else}
								<span
									class:font-mono={sec.id === 'competencies'}
									class:underline={line.overridden}
									class:decoration-dotted={line.overridden}
									title={line.overridden ? 'Edited by hand' : undefined}
									data-overridden={line.overridden ? '' : undefined}>{line.value}</span
								>
							{/if}
							{#if line.roll}
								{#if onroll}
									<RollButton roll={line.roll} label={rollLabel(line)} {onroll} />
								{:else}
									<span class="font-mono text-xs text-ink-muted">{line.roll}</span>
								{/if}
							{/if}
							{#if line.note}<span class="text-ink-muted">{line.note}</span>{/if}
							{#if onoverride && controls}
								<span class="ml-auto flex shrink-0 self-start" data-controls>
									<button
										type="button"
										class="rounded p-1 text-ink-muted hover:bg-surface-3 hover:text-ink"
										aria-label={`Edit ${rollLabel(line)}`}
										title="Edit the value"
										onclick={() => startEdit(line)}
									>
										<Pencil size={12} aria-hidden="true" />
									</button>
									<button
										type="button"
										class="rounded p-1 text-ink-muted hover:bg-surface-3 hover:text-ink disabled:invisible"
										aria-label={`Reset ${rollLabel(line)}`}
										title="Back to the generated value"
										disabled={!line.overridden}
										onclick={() => onoverride(line.id, null)}
									>
										<RotateCcw size={12} aria-hidden="true" />
									</button>
								</span>
							{/if}
						</dd>
					{/each}
					{#if sec.lines.length === 0}
						<dd class="col-span-2 text-ink-muted">None</dd>
					{/if}
				</dl>
			</section>
		{/each}
	</div>
{/if}
