<script lang="ts">
	import {
		ChevronDown,
		ChevronRight,
		ClipboardCopy,
		Crown,
		Download,
		Dices,
		Printer,
		Star,
		Trash2,
		UserPlus
	} from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { generator } from '../../data/generator.svelte';
	import { library, type SavedRecord } from '../../data/library.svelte';
	import { prefs } from '../../data/prefs.svelte';
	import { router, routeToHash } from '../../data/router.svelte';
	import { chronicleMarkdown, npcMarkdown, partyMarkdown, tallyhoText } from '../../engine/export';
	import { memberOrder } from '../../engine/party';
	import { formatSeed } from '../../engine/rng';
	import type { Npc, SavedNpc, SavedParty } from '../../engine/schema';
	import { downloadText, slug } from './download';
	import Chronicle from './Chronicle.svelte';
	import NpcSheet from './NpcSheet.svelte';
	import MemberActions from '../party/MemberActions.svelte';
	import { blockOf, textOptions } from './render';

	let { kind, id }: { kind: 'npc' | 'party'; id: string } = $props();

	const record = $derived<SavedRecord | undefined>(
		kind === 'npc' ? library.npc(id) : library.party(id)
	);
	const npcRecord = $derived(record && 'npc' in record ? (record as SavedNpc) : null);
	const partyRecord = $derived(record && 'party' in record ? (record as SavedParty) : null);
	const block = $derived(
		npcRecord ? blockOf(npcRecord.npc, npcRecord.recipe, npcRecord.overrides) : null
	);
	const memberBlocks = $derived(
		partyRecord ? partyRecord.party.members.map((m) => blockOf(m, partyRecord.recipe)) : []
	);
	const title = $derived(npcRecord?.npc.narrative.name.full ?? partyRecord?.party.name ?? '');
	let compact = $state(prefs.defaultView === 'compact');
	const hasBlocks = $derived(!!npcRecord?.npc.profile || !!partyRecord);

	let message = $state('');
	let confirmDelete = $state(false);
	const open = new SvelteSet<number>();

	function say(text: string) {
		message = text;
		setTimeout(() => (message = ''), 2000);
	}

	function markdown(): string {
		const chronicle = chronicleMarkdown(record?.chronicle ?? []);
		if (npcRecord) {
			return (
				npcMarkdown(npcRecord.npc, block, textOptions(npcRecord.npc, npcRecord.recipe), {
					seed: formatSeed(npcRecord.recipe.seed)
				}) + chronicle
			);
		}
		const p = partyRecord!;
		return (
			partyMarkdown(p.party, {
				member: (i) => textOptions(p.party.members[i], p.recipe),
				blocks: memberBlocks,
				order: memberOrder(p.party),
				averagePower: p.recipe.options.power,
				seed: formatSeed(p.recipe.seed)
			}) + chronicle
		);
	}

	async function copyMarkdown() {
		await navigator.clipboard.writeText(markdown());
		say('Markdown copied');
	}
	async function copyTallyho() {
		if (!npcRecord) return;
		await navigator.clipboard.writeText(
			tallyhoText(npcRecord.npc, block, textOptions(npcRecord.npc, npcRecord.recipe))
		);
		say('Copied for TallyHo');
	}
	function downloadMarkdown() {
		downloadText(`${slug(title)}.md`, markdown(), 'text/markdown');
	}
	function downloadJson() {
		downloadText(`${slug(title)}.json`, JSON.stringify(record, null, 2));
	}
	function openInGenerator() {
		if (!record) return;
		generator.loadRecord(
			record.recipe,
			npcRecord?.overrides ?? {},
			npcRecord?.tracker ?? undefined
		);
		router.go({ screen: 'generate' });
	}
	async function addToRoster() {
		if (!npcRecord) return;
		await library.addToRoster(npcRecord.id, npcRecord.npc.narrative.occupation);
		say('Added to the roster');
	}
	async function remove() {
		if (!record) return;
		await library.remove(record);
		router.go({ screen: 'library' });
	}
	function setTags(text: string) {
		if (!record) return;
		const tags = [
			...new Set(
				text
					.split(',')
					.map((t) => t.trim())
					.filter(Boolean)
			)
		];
		library.update(record, { tags });
	}
	function toggleOpen(i: number) {
		if (open.has(i)) open.delete(i);
		else open.add(i);
	}
	const memberSummary = (m: Npc) =>
		m.profile ? `${m.profile.archetypeLabel} | power ${m.profile.power}` : '';
</script>

<section class="mx-auto max-w-3xl p-4" aria-labelledby="record-title">
	{#if !library.ready}
		<p class="text-center text-ink-muted">Loading…</p>
	{:else if !record}
		<h1 id="record-title" class="text-xl font-semibold">Not in the library</h1>
		<p class="mt-2 text-ink-muted">
			This record was deleted or never saved on this device.
			<a class="text-accent hover:underline" href={routeToHash({ screen: 'library' })}
				>Back to the library</a
			>
		</p>
	{:else}
		<div class="flex flex-wrap items-center gap-2">
			<a class="text-sm text-ink-muted hover:underline" href={routeToHash({ screen: 'library' })}
				>Library</a
			>
			<span class="text-ink-muted">/</span>
			<h1 id="record-title" class="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
			<button
				type="button"
				class="rounded p-2 text-ink-muted hover:bg-surface-3 aria-pressed:text-accent"
				aria-pressed={record.favourite}
				aria-label={record.favourite ? 'Remove from favourites' : 'Add to favourites'}
				onclick={() => library.update(record!, { favourite: !record!.favourite })}
			>
				<Star size={18} aria-hidden="true" fill={record.favourite ? 'currentColor' : 'none'} />
			</button>
		</div>

		<div class="mt-2 flex flex-wrap gap-1 print:hidden">
			{#if hasBlocks}
				<div
					class="mr-1 flex rounded border border-border text-sm"
					role="group"
					aria-label="Stat block view"
				>
					<button
						type="button"
						class="rounded-l px-2 py-1 aria-pressed:bg-surface-3 aria-pressed:font-medium"
						aria-pressed={!compact}
						onclick={() => (compact = false)}>Full</button
					>
					<button
						type="button"
						class="rounded-r px-2 py-1 aria-pressed:bg-surface-3 aria-pressed:font-medium"
						aria-pressed={compact}
						onclick={() => (compact = true)}>Compact</button
					>
				</div>
			{/if}
			<button
				type="button"
				class="flex items-center gap-1 rounded border border-border px-2 py-1.5 text-sm hover:bg-surface-3"
				onclick={openInGenerator}
			>
				<Dices size={14} aria-hidden="true" /> Open in generator
			</button>
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
				onclick={copyMarkdown}
			>
				<ClipboardCopy size={14} aria-hidden="true" /> Copy Markdown
			</button>
			{#if npcRecord}
				<button
					type="button"
					class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
					onclick={copyTallyho}
				>
					<ClipboardCopy size={14} aria-hidden="true" /> Copy for TallyHo
				</button>
			{/if}
			{#if npcRecord}
				<button
					type="button"
					class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
					onclick={addToRoster}
				>
					<UserPlus size={14} aria-hidden="true" /> Add to roster
				</button>
			{/if}
		</div>
		<div class="mt-1 flex flex-wrap gap-1 print:hidden">
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
				onclick={downloadMarkdown}
			>
				<Download size={14} aria-hidden="true" /> Markdown file
			</button>
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
				onclick={downloadJson}
			>
				<Download size={14} aria-hidden="true" /> JSON file
			</button>
			<a
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
				href={routeToHash({ screen: 'print', kind, ids: [record.id] })}
			>
				<Printer size={14} aria-hidden="true" /> Print
			</a>
			{#if confirmDelete}
				<span class="ml-auto flex items-center gap-1 text-sm">
					Delete this record?
					<button
						type="button"
						class="rounded border border-danger px-2 py-1 text-danger hover:bg-surface-3"
						onclick={remove}>Delete</button
					>
					<button
						type="button"
						class="rounded px-2 py-1 hover:bg-surface-3"
						onclick={() => (confirmDelete = false)}>Keep</button
					>
				</span>
			{:else}
				<button
					type="button"
					class="ml-auto flex items-center gap-1 rounded px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-3 hover:text-danger"
					onclick={() => (confirmDelete = true)}
				>
					<Trash2 size={14} aria-hidden="true" /> Delete
				</button>
			{/if}
		</div>
		<p class="mt-1 flex h-5 items-center text-sm text-ink-muted" role="status" aria-live="polite">
			{message}
		</p>

		<div class="mt-2 grid gap-3 sm:grid-cols-2 print:hidden">
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-ink-muted">Tags (comma separated)</span>
				<input
					class="rounded border border-border bg-surface px-2 py-1.5"
					value={record.tags.join(', ')}
					onchange={(e) => setTags(e.currentTarget.value)}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-ink-muted">Notes</span>
				<textarea
					class="min-h-9 rounded border border-border bg-surface px-2 py-1.5"
					rows="2"
					value={record.notes}
					onchange={(e) => library.update(record!, { notes: e.currentTarget.value })}></textarea>
			</label>
		</div>
		<Chronicle {record} onnotice={say} />
		<p class="mt-1 text-xs text-ink-muted">
			Seed {formatSeed(record.recipe.seed)} | saved {new Date(record.createdAt).toLocaleString()}
			{#if npcRecord?.tracker}
				| HP {npcRecord.tracker.hp}/{npcRecord.tracker.hpMax}{npcRecord.tracker.conditions.length
					? `, ${npcRecord.tracker.conditions.join(', ')}`
					: ''}
			{/if}
		</p>

		<article class="mt-4 rounded-lg border border-border bg-surface-2 p-4">
			{#if npcRecord}
				<NpcSheet npc={npcRecord.npc} {block} {compact} preset={npcRecord.recipe.preset} />
			{:else if partyRecord}
				{@const p = partyRecord.party}
				<header class="mb-3">
					<h2 class="text-2xl font-semibold wrap-break-word">{p.name}</h2>
					<p class="min-h-5 text-sm text-ink-muted">
						{p.members.length} members | average power {partyRecord.recipe.options.power} | led by {p
							.members[p.leaderIndex].narrative.name.given}
					</p>
				</header>
				<dl class="divide-y divide-border">
					{#each [['Reputation', p.reputation], ['Goal', p.goal], ['Hook', p.hook], ['Tactics', p.tactics], ['Loot', `${p.loot.pool} | ${p.loot.notable}`]] as [label, value] (label)}
						<div class="flex flex-col px-2 py-1.5 sm:flex-row sm:gap-2">
							<dt
								class="w-24 shrink-0 pt-0.5 text-xs font-medium tracking-wide text-ink-muted uppercase sm:w-28"
							>
								{label}
							</dt>
							<dd class="min-w-0 flex-1 wrap-break-word">{value}</dd>
						</div>
					{/each}
				</dl>
				<h3 class="mt-4 text-xs font-medium tracking-wide text-ink-muted uppercase">
					Relationships
				</h3>
				<ul class="mt-1 space-y-1 text-sm">
					{#each p.relationships as r, i (i)}
						<li>
							<span class="text-ink-muted capitalize">{r.kind}</span><span
								class="mx-1 text-ink-muted">|</span
							>{r.text}
						</li>
					{/each}
				</ul>
				<h3 class="mt-4 text-xs font-medium tracking-wide text-ink-muted uppercase">Members</h3>
				<ul class="mt-1 space-y-2">
					{#each memberOrder(p) as i (i)}
						{@const m = p.members[i]}
						<li class="rounded-lg border border-border bg-surface" data-member={i}>
							<div class="flex items-start">
								<button
									type="button"
									class="flex min-w-0 flex-1 items-start gap-2 p-2 text-left hover:bg-surface-3"
									aria-expanded={open.has(i)}
									onclick={() => toggleOpen(i)}
								>
									{#if open.has(i)}<ChevronDown
											size={16}
											class="mt-1 shrink-0"
											aria-hidden="true"
										/>{:else}<ChevronRight
											size={16}
											class="mt-1 shrink-0"
											aria-hidden="true"
										/>{/if}
									<span class="min-w-0 flex-1">
										<strong>{m.narrative.name.full}</strong>
										{#if i === p.leaderIndex}
											<span
												class="ml-2 inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 text-xs font-medium"
												><Crown size={12} aria-hidden="true" /> Leader</span
											>
										{/if}
										<span class="block text-sm text-ink-muted">{memberSummary(m)}</span>
									</span>
								</button>
								<div class="p-2">
									<MemberActions
										party={p}
										recipe={partyRecord.recipe}
										index={i}
										block={memberBlocks[i]}
										onnotice={say}
									/>
								</div>
							</div>
							{#if open.has(i)}
								<div class="border-t border-border p-3">
									<NpcSheet
										npc={m}
										block={memberBlocks[i]}
										heading="h3"
										{compact}
										preset={partyRecord.recipe.preset}
									/>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</article>
	{/if}
</section>
