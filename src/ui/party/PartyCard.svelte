<script lang="ts">
	import { ListOrdered, X } from '@lucide/svelte';
	import { generator } from '../../data/generator.svelte';
	import { initiative } from '../../data/initiative.svelte';
	import { prefs } from '../../data/prefs.svelte';
	import { DEFAULT_INITIATIVE } from '../../engine/initiative';
	import { memberOrder, type PartyTarget } from '../../engine/party';
	import type { NarrativeField, Party, PartyField, ProfileField } from '../../engine/schema';
	import LockReroll from '../common/LockReroll.svelte';
	import FieldRow from '../generate/FieldRow.svelte';
	import MemberActions from './MemberActions.svelte';
	import MemberCard from './MemberCard.svelte';

	let {
		party,
		compact,
		onroll,
		onnotice
	}: {
		party: Party;
		compact: boolean;
		onroll?: (roll: string, label: string) => void;
		onnotice?: (text: string) => void;
	} = $props();

	const recipe = $derived(generator.recipe);
	const blocks = $derived(generator.memberBlocks);
	const leader = $derived(party.members[party.leaderIndex]);

	const rows: [PartyField, string, (p: Party) => string][] = [
		['reputation', 'Reputation', (p) => p.reputation],
		['goal', 'Goal', (p) => p.goal],
		['hook', 'Hook', (p) => p.hook],
		['tactics', 'Tactics', (p) => p.tactics],
		['loot', 'Loot', (p) => `${p.loot.pool} | ${p.loot.notable}`],
		['leader', 'Leader', (p) => p.members[p.leaderIndex].narrative.name.full]
	];

	const field = (f: PartyField): PartyTarget => ({ field: f });
	const member = (i: number, f?: NarrativeField | ProfileField): PartyTarget =>
		f === undefined ? { member: i } : { member: i, field: f };

	$effect(() => {
		initiative.sync(`${recipe.seed}|${recipe.options.partySize}`);
	});

	function rollInitiative() {
		initiative.roll(
			`${recipe.seed}|${recipe.options.partySize}`,
			party.members.map((m, i) => ({
				name: m.narrative.name.full,
				dice: blocks[i]?.tracker.initiative ?? DEFAULT_INITIATIVE
			}))
		);
	}
</script>

<header class="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
	<div class="min-w-0">
		<h2
			class="text-2xl font-semibold wrap-break-word"
			class:text-accent={generator.isPartyLocked(field('name'))}
		>
			{party.name}
		</h2>
		<p class="min-h-5 text-sm text-ink-muted">
			{party.members.length} members | average power {recipe.options.power} | led by {leader
				.narrative.name.given}
		</p>
	</div>
	<div class="flex gap-0.5" data-party-field="name">
		<LockReroll
			label="Party name"
			locked={generator.isPartyLocked(field('name'))}
			onreroll={() => generator.rerollParty(field('name'))}
			ontogglelock={() => generator.togglePartyLock(field('name'))}
		/>
	</div>
</header>

<dl class="divide-y divide-border">
	{#each rows as [f, label, text] (f)}
		<FieldRow
			field={`party.${f}`}
			{label}
			value={text(party)}
			locked={generator.isPartyLocked(field(f))}
			onreroll={() => generator.rerollParty(field(f))}
			ontogglelock={() => generator.togglePartyLock(field(f))}
		/>
	{/each}
</dl>

<section class="mt-4" aria-labelledby="relationships-title" data-section="relationships">
	<div class="flex items-center gap-2">
		<h3 id="relationships-title" class="text-xs font-medium tracking-wide text-ink-muted uppercase">
			Relationships
		</h3>
		<div class="ml-auto flex gap-0.5" data-field="party.relationships">
			<LockReroll
				label="Relationships"
				locked={generator.isPartyLocked(field('relationships'))}
				onreroll={() => generator.rerollParty(field('relationships'))}
				ontogglelock={() => generator.togglePartyLock(field('relationships'))}
				size={14}
			/>
		</div>
	</div>
	<ul class="mt-1 space-y-1 text-sm">
		{#each party.relationships as r, i (i)}
			<li>
				<span class="text-ink-muted capitalize">{r.kind}</span>
				<span class="mx-1 text-ink-muted">|</span>{r.text}
			</li>
		{/each}
	</ul>
</section>

<section class="mt-4" aria-labelledby="members-title" data-section="members">
	<h3 id="members-title" class="text-xs font-medium tracking-wide text-ink-muted uppercase">
		Members
	</h3>
	<ul class="mt-1 space-y-2">
		{#each memberOrder(party) as i (i)}
			<MemberCard
				index={i}
				member={party.members[i]}
				preset={recipe.preset}
				block={blocks[i] ?? null}
				leader={i === party.leaderIndex}
				{compact}
				isLocked={(f) => generator.isPartyLocked(member(i, f))}
				onreroll={(f) => generator.rerollParty(member(i, f))}
				ontogglelock={(f) => generator.togglePartyLock(member(i, f))}
				{onroll}
			>
				{#snippet actions()}
					<MemberActions {party} {recipe} index={i} block={blocks[i] ?? null} {onnotice} />
				{/snippet}
			</MemberCard>
		{/each}
	</ul>
</section>

{#if prefs.has('initiative')}
	<section
		class="mt-4 rounded-lg border border-border bg-surface p-3"
		aria-labelledby="initiative-title"
		data-section="initiative"
	>
		<div class="flex flex-wrap items-center gap-2">
			<h3 id="initiative-title" class="text-xs font-medium tracking-wide text-ink-muted uppercase">
				Initiative
			</h3>
			<div class="ml-auto flex items-center gap-1">
				<button
					type="button"
					class="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-surface-3"
					onclick={rollInitiative}
				>
					<ListOrdered size={14} aria-hidden="true" />
					Roll initiative
				</button>
				<button
					type="button"
					class="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-surface-3 disabled:invisible"
					disabled={initiative.order.length === 0}
					onclick={() => initiative.clear()}
				>
					<X size={14} aria-hidden="true" />
					Clear
				</button>
			</div>
		</div>
		<ol class="mt-2 min-h-5 space-y-0.5 text-sm" aria-label="Initiative order">
			{#each initiative.order as e, i (e.index)}
				<li class="flex items-baseline gap-2">
					<span class="w-5 text-right text-ink-muted tabular-nums">{i + 1}.</span>
					<span class="font-medium">{e.name}</span>
					<span class="font-mono tabular-nums">{e.total}</span>
					<span class="text-xs text-ink-muted">{e.breakdown}</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}
