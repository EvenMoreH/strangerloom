<script lang="ts">
	import {
		ArrowUpCircle,
		Bookmark,
		Check,
		ClipboardCopy,
		Copy,
		Dices,
		Filter,
		Link,
		Quote,
		SlidersHorizontal,
		Sprout,
		Users
	} from '@lucide/svelte';
	import { PRESETS } from '../../content';
	import { generator } from '../../data/generator.svelte';
	import { library } from '../../data/library.svelte';
	import { tallyhoText } from '../../engine/export';
	import { prefs } from '../../data/prefs.svelte';
	import { rolls } from '../../data/rolls.svelte';
	import { router, routeToHash } from '../../data/router.svelte';
	import { tracker } from '../../data/tracker.svelte';
	import { withoutEmbedTheme } from '../../engine/embed';
	import { formatSeed } from '../../engine/rng';
	import type { NarrativeField, PartyField, ProfileField } from '../../engine/schema';
	import LockReroll from '../common/LockReroll.svelte';
	import PartyCard from '../party/PartyCard.svelte';
	import StatBlock from '../statblock/StatBlock.svelte';
	import Tracker from '../tools/Tracker.svelte';
	import {
		blurbLine,
		blurbText,
		displayField,
		NARRATIVE_ROWS,
		npcPlainText,
		textOptionsOf
	} from './display';
	import { memberOrder } from '../../engine/party';
	import FieldRow from './FieldRow.svelte';

	let { shareCode }: { shareCode?: string } = $props();

	const npc = $derived(generator.npc);
	const party = $derived(generator.party);
	const narrative = $derived(generator.npc?.narrative);
	const recipe = $derived(generator.recipe);
	const preset = $derived(generator.preset);
	const block = $derived(generator.block);

	let seedInput = $state('');
	let seedError = $state(false);
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	let fieldsOpen = $state(false);
	let filtersOpen = $state(false);
	const TONES = ['light', 'neutral', 'dark'];
	const filterCount = $derived(
		recipe.filters.tone.length + recipe.filters.ancestries.length + recipe.filters.archetypes.length
	);
	function toggleIn(list: string[], value: string, on: boolean): string[] {
		return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
	}
	let compact = $state(prefs.defaultView === 'compact');
	let lastRoll = $state('');

	$effect(() => {
		// The tracker follows the NPC, the adapter and the hit point maximum (an override of it starts over).
		if (block) {
			tracker.sync(
				`${recipe.seed}|${recipe.tier}|${block.adapter}|${block.tracker.hpMax ?? ''}`,
				block.tracker
			);
			const saved = generator.takePendingTracker();
			if (saved) tracker.restore(saved);
		}
	});

	async function save() {
		try {
			if (party) {
				await library.saveParty(recipe, party);
			} else if (npc) {
				await library.saveNpc(
					recipe,
					npc,
					generator.allOverrides,
					block ? tracker.state : undefined
				);
			} else return;
			say('Saved to the library');
		} catch (err) {
			say(`Not saved: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function copyTallyho() {
		if (!npc || !narrative) return;
		await navigator.clipboard.writeText(
			tallyhoText(
				npc,
				block,
				textOptionsOf(narrative, (f) => prefs.isHidden(f), recipe.preset)
			)
		);
		say('Copied for TallyHo');
	}

	function onRoll(roll: string, label: string) {
		const entry = rolls.roll(roll, label);
		lastRoll = `${label}: ${entry.breakdown}`;
	}

	function say(text: string) {
		notice = text;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 2000);
	}

	$effect(() => {
		if (shareCode) {
			generator.loadShare(shareCode).then((ok) => {
				if (ok) router.go({ screen: 'generate' });
			});
		} else if (!generator.npc && !generator.party) {
			generator.generate();
		}
	});

	$effect(() => {
		seedInput = formatSeed(recipe.seed);
		seedError = false;
	});

	function applySeed() {
		if (generator.applySeed(seedInput)) {
			seedError = false;
			say('Seed applied');
		} else {
			seedError = true;
		}
	}

	async function copySeed() {
		await navigator.clipboard.writeText(formatSeed(recipe.seed));
		say('Seed copied');
	}

	async function copyLink() {
		const code = await generator.shareCode();
		// A link copied inside TallyHo's frame leaves the frame's theme parameter behind.
		const url = `${location.origin}${location.pathname}${withoutEmbedTheme(location.search)}${routeToHash({ screen: 'shared', code })}`;
		await navigator.clipboard.writeText(url);
		say('Link copied');
	}

	const npcText = (n: NonNullable<typeof narrative>, b: typeof block) =>
		npcPlainText(n, b, (f) => prefs.isHidden(f), recipe.preset);

	async function copyBlurb() {
		if (!npc) return;
		await navigator.clipboard.writeText(blurbText(npc, (f) => prefs.isHidden(f), recipe.preset));
		say('Blurb copied');
	}

	async function copyText() {
		let text: string;
		if (party) {
			const names = (i: number) => party.members[i].narrative.name.full;
			text = [
				party.name,
				`${party.members.length} members | average power ${recipe.options.power} | led by ${names(party.leaderIndex)}`,
				`Reputation: ${party.reputation}`,
				`Goal: ${party.goal}`,
				`Hook: ${party.hook}`,
				`Tactics: ${party.tactics}`,
				`Loot: ${party.loot.pool} | ${party.loot.notable}`,
				'',
				'Relationships',
				...party.relationships.map((r) => `  ${r.kind}: ${r.text}`),
				...memberOrder(party).flatMap((i) => [
					'',
					`== ${i === party.leaderIndex ? 'Leader: ' : ''}${names(i)}`,
					npcText(party.members[i].narrative, generator.memberBlocks[i] ?? null)
				])
			].join('\n');
		} else if (narrative) {
			text = npcText(narrative, block);
		} else return;
		await navigator.clipboard.writeText(`${text}\nSeed: ${formatSeed(recipe.seed)}`);
		say('Text copied');
	}

	const rows = NARRATIVE_ROWS;
	const visibleRows = $derived(rows.filter(([field]) => !prefs.isHidden(field)));

	/** The summary under the name: ancestry, age and occupation, leaving out hidden fields. */
	const headerSummary = $derived(
		narrative ? blurbLine(narrative, (f) => prefs.isHidden(f), recipe.preset) : ''
	);

	function display(field: NarrativeField): string {
		return narrative ? displayField(narrative, field, recipe.preset) : '';
	}

	function isEditable(el: Element | null): boolean {
		if (!el) return false;
		const tag = el.tagName;
		return (
			tag === 'INPUT' ||
			tag === 'TEXTAREA' ||
			tag === 'SELECT' ||
			(el as HTMLElement).isContentEditable
		);
	}

	function onKeydown(e: KeyboardEvent) {
		if (!prefs.has('shortcuts')) return;
		if (e.ctrlKey || e.metaKey || e.altKey || isEditable(document.activeElement)) return;
		const key = e.key.toLowerCase();
		if (key === 'g') {
			e.preventDefault();
			generator.generate();
			return;
		}
		if (key === 's') {
			e.preventDefault();
			void save();
			return;
		}
		if (key !== 'r' && key !== 'l') return;
		const row = document.activeElement?.closest<HTMLElement>('[data-field]');
		if (!row) return;
		e.preventDefault();
		const raw = row.dataset.field!;
		if (party) {
			// On the party card a row is a party field (`party.goal`), a member (`member`) or a member's field.
			const memberEl = row.closest<HTMLElement>('[data-member]');
			const target = raw.startsWith('party.')
				? { field: raw.slice(6) as PartyField }
				: memberEl
					? raw === 'member'
						? { member: Number(memberEl.dataset.member) }
						: {
								member: Number(memberEl.dataset.member),
								field: raw as NarrativeField | ProfileField
							}
					: null;
			if (!target) return;
			if (key === 'r') generator.rerollParty(target);
			else generator.togglePartyLock(target);
			return;
		}
		const field = raw as NarrativeField | ProfileField;
		if (key === 'r') generator.reroll(field);
		else generator.toggleLock(field);
	}

	const tiers: { tier: 1 | 2 | 3; label: string; disabled?: string }[] = [
		{ tier: 1, label: 'Flavour NPC' },
		{ tier: 2, label: 'Combat NPC' },
		{ tier: 3, label: 'Party' }
	];
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet cardActions()}
	<!-- Actions on the result live on the card: view, fields, save, copies and the share link. -->
	<div
		class="mb-3 flex flex-wrap items-center gap-1 border-b border-border pb-2 whitespace-nowrap"
		data-card-actions
	>
		{#if recipe.tier >= 2}
			<div
				class="flex rounded border border-border text-sm"
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
			class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
			aria-expanded={fieldsOpen}
			aria-controls="fields-picker"
			onclick={() => (fieldsOpen = !fieldsOpen)}
		>
			<SlidersHorizontal size={14} aria-hidden="true" />
			Fields <span class="text-ink-muted tabular-nums">({visibleRows.length}/{rows.length})</span>
		</button>
		<span class="flex-1"></span>
		<button
			type="button"
			class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
			title="Save to the library (S)"
			onclick={save}
		>
			<Bookmark size={14} aria-hidden="true" /> Save
		</button>
		<button
			type="button"
			class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
			onclick={copyText}
		>
			<Copy size={14} aria-hidden="true" /> Copy as text
		</button>
		{#if npc}
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
				title="Plain text that TallyHo reads into a wiki NPC"
				onclick={copyTallyho}
			>
				<ClipboardCopy size={14} aria-hidden="true" /> Copy for TallyHo
			</button>
		{/if}
		<button
			type="button"
			class="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-surface-3"
			title="Copy a link that opens this result"
			onclick={copyLink}
		>
			<Link size={14} aria-hidden="true" /> Share link
		</button>
	</div>
	<!-- Reserved line, so a notice never moves the card. -->
	<p
		class="-mt-2 mb-2 flex h-5 items-center justify-end gap-1 text-sm text-ink-muted"
		role="status"
		aria-live="polite"
	>
		{#if notice}<Check size={14} aria-hidden="true" />{notice}{/if}
	</p>
	{#if fieldsOpen}
		<fieldset id="fields-picker" class="mb-3 rounded-lg border border-border bg-surface p-3">
			<legend class="px-1 text-sm font-medium">Fields shown on the card</legend>
			<div class="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
				{#each rows as [field, label] (field)}
					<label class="flex min-h-9 items-center gap-2 text-sm">
						<input
							type="checkbox"
							class="accent-accent"
							checked={!prefs.isHidden(field)}
							onchange={(e) => prefs.setFieldHidden(field, !e.currentTarget.checked)}
						/>
						{label}
					</label>
				{/each}
			</div>
			{#if prefs.hiddenFields.length}
				<button
					type="button"
					class="mt-2 text-sm text-accent hover:underline"
					onclick={() => prefs.showAllFields()}
				>
					Show all
				</button>
			{/if}
		</fieldset>
	{/if}
{/snippet}

<section class="mx-auto max-w-3xl p-4" aria-labelledby="generate-title">
	<h1 id="generate-title" class="sr-only">Generate</h1>

	<div class="flex flex-wrap items-center gap-3">
		<div
			class="flex min-w-64 flex-[999_1_0%] gap-1 rounded-lg bg-surface-2 p-1"
			role="tablist"
			aria-label="Detail tier"
		>
			{#each tiers as t (t.tier)}
				<button
					type="button"
					role="tab"
					aria-selected={recipe.tier === t.tier}
					disabled={!!t.disabled}
					title={t.disabled}
					class="flex-1 rounded-md px-3 py-1.5 text-sm text-ink-muted aria-selected:bg-surface aria-selected:font-medium aria-selected:text-ink aria-selected:shadow-sm"
					onclick={() => generator.setTier(t.tier)}
				>
					{t.label}
				</button>
			{/each}
		</div>
		<!-- From 640 px up Filters, the seed and Generate show their words and icons as on a desktop; below, Filters
		     and the seed show only their icons and Generate only its word. While the group shares a line with the
		     tabs, the tabs' grow weight of 999 keeps the spare space with them; on a line of its own the group fills
		     it and Generate grows into the space left. -->
		<div class="ml-auto flex grow flex-wrap items-center gap-1.5 sm:gap-2">
			<button
				type="button"
				class="flex items-center justify-center gap-1 rounded-md border border-border p-2 text-sm hover:bg-surface-3 aria-expanded:bg-surface-3 sm:py-1.5"
				aria-expanded={filtersOpen}
				aria-controls="filters-panel"
				title="Filters"
				onclick={() => (filtersOpen = !filtersOpen)}
			>
				<Filter size={16} aria-hidden="true" />
				<span class="sr-only sm:not-sr-only">Filters</span>
				{#if filterCount}
					<span class="rounded-full bg-accent-fill px-1.5 text-xs text-accent-ink tabular-nums"
						>{filterCount}</span
					>
				{/if}
			</button>
			<div
				class="flex items-center rounded-md border border-border bg-surface focus-within:border-border-strong"
				class:border-danger={seedError}
			>
				<label class="flex items-center" title="Seed">
					<Sprout size={16} class="ml-1 shrink-0 text-ink-muted sm:hidden" aria-hidden="true" />
					<span class="hidden pl-2 text-xs tracking-wide text-ink-muted uppercase sm:inline"
						>Seed</span
					>
					<input
						class="w-28 bg-transparent px-2 py-1.5 font-mono tracking-wider uppercase"
						aria-invalid={seedError}
						aria-label="Seed"
						bind:value={seedInput}
						onkeydown={(e) => e.key === 'Enter' && applySeed()}
						onblur={() => seedInput !== formatSeed(recipe.seed) && applySeed()}
						spellcheck="false"
						autocomplete="off"
					/>
				</label>
				<button
					type="button"
					class="rounded-r-md p-2 hover:bg-surface-3"
					aria-label="Copy seed"
					title="Copy seed"
					onclick={copySeed}
				>
					<Copy size={16} aria-hidden="true" />
				</button>
			</div>
			<button
				type="button"
				class="flex grow items-center justify-center gap-2 rounded-md bg-accent-fill px-2.5 py-2 font-medium text-accent-ink glow hover:opacity-90 sm:px-4"
				onclick={() => generator.generate()}
				title="Generate (G)"
			>
				<Dices size={18} class="hidden sm:block" aria-hidden="true" />
				Generate
			</button>
		</div>
	</div>

	<form class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" onsubmit={(e) => e.preventDefault()}>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-ink-muted">Setting</span>
			<select
				class="rounded border border-border bg-surface px-2 py-1.5"
				value={recipe.preset}
				onchange={(e) => generator.setPreset(e.currentTarget.value)}
			>
				{#each PRESETS.presets as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-ink-muted">Ancestry</span>
			<select
				class="rounded border border-border bg-surface px-2 py-1.5"
				value={recipe.options.ancestry}
				onchange={(e) => generator.setOption('ancestry', e.currentTarget.value)}
			>
				<option value="any">Any</option>
				{#each preset.ancestries as a (a.id)}
					<option value={a.id}>{PRESETS.ancestries[a.id]?.label ?? a.id}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="text-ink-muted">Gender</span>
			<select
				class="rounded border border-border bg-surface px-2 py-1.5"
				value={recipe.options.gender}
				onchange={(e) =>
					generator.setOption('gender', e.currentTarget.value as 'any' | 'f' | 'm' | 'n')}
			>
				<option value="any">Any</option>
				<option value="f">Feminine</option>
				<option value="m">Masculine</option>
				<option value="n">Neutral</option>
			</select>
		</label>
		{#if recipe.tier === 3}
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-ink-muted">Party size</span>
				<select
					class="rounded border border-border bg-surface px-2 py-1.5"
					value={String(recipe.options.partySize)}
					onchange={(e) => generator.setOption('partySize', Number(e.currentTarget.value))}
				>
					{#each [3, 4, 5, 6] as n (n)}
						<option value={String(n)}>{n} members</option>
					{/each}
				</select>
			</label>
		{:else if recipe.tier >= 2}
			<label class="flex flex-col gap-1 text-sm">
				<span class="text-ink-muted">Archetype</span>
				<select
					class="rounded border border-border bg-surface px-2 py-1.5"
					value={recipe.options.archetype}
					onchange={(e) => generator.setOption('archetype', e.currentTarget.value)}
				>
					<option value="any">Any (from occupation)</option>
					{#each generator.archetypes as a (a.id)}
						<option value={a.id}>{a.label}</option>
					{/each}
				</select>
			</label>
		{/if}
		{#if preset.cultures.length}
			<label class="col-start-1 flex flex-col gap-1 text-sm">
				<span class="text-ink-muted">Culture</span>
				<select
					class="rounded border border-border bg-surface px-2 py-1.5"
					value={recipe.options.culture}
					onchange={(e) => generator.setOption('culture', e.currentTarget.value)}
				>
					<option value="any">Any</option>
					{#each preset.cultures as c (c)}
						<option value={c}>{PRESETS.cultures[c]?.label ?? c}</option>
					{/each}
				</select>
			</label>
		{/if}
		{#if recipe.tier >= 2}
			<label class="col-start-2 flex flex-col gap-1 text-sm">
				<span class="text-ink-muted">System</span>
				<select
					class="rounded border border-border bg-surface px-2 py-1.5"
					value={generator.adapter}
					onchange={(e) => generator.setAdapter(e.currentTarget.value)}
				>
					{#each generator.adapters as a (a.id)}
						<option value={a.id}>{a.name}</option>
					{/each}
				</select>
			</label>
			<label class="col-start-1 flex flex-col gap-1 text-sm sm:col-start-3">
				<span class="text-ink-muted"
					>{recipe.tier === 3 ? 'Average power' : 'Power'}
					<strong class="text-ink">{recipe.options.power}</strong></span
				>
				<input
					type="range"
					min="1"
					max="10"
					class="mt-2 accent-accent"
					value={recipe.options.power}
					oninput={(e) => generator.setOption('power', Number(e.currentTarget.value))}
				/>
			</label>
			<label class="col-start-2 flex flex-col gap-1 text-sm sm:col-start-4">
				<span class="text-ink-muted">Threat</span>
				<select
					class="rounded border border-border bg-surface px-2 py-1.5"
					value={recipe.options.threat}
					onchange={(e) =>
						generator.setOption(
							'threat',
							e.currentTarget.value as 'auto' | 'minion' | 'standard' | 'elite' | 'boss'
						)}
				>
					<option value="auto">From power</option>
					<option value="minion">Minion</option>
					<option value="standard">Standard</option>
					<option value="elite">Elite</option>
					<option value="boss">Boss</option>
				</select>
			</label>
		{/if}
	</form>

	{#if filtersOpen}
		<div id="filters-panel" class="mt-3 rounded-lg border border-border bg-surface-2 p-3 text-sm">
			<div class="flex items-center gap-2">
				<p class="text-ink-muted">
					Filters narrow what Generate and rerolls draw from. Nothing ticked in a group means the
					setting's default.
				</p>
				<button
					type="button"
					class="ml-auto rounded px-2 py-1 text-sm whitespace-nowrap text-ink-muted hover:bg-surface-3 disabled:opacity-50"
					disabled={!filterCount}
					onclick={() => generator.clearFilters()}
				>
					Clear filters
				</button>
			</div>
			<div class="mt-2 grid gap-3 sm:grid-cols-3">
				<fieldset>
					<legend class="text-xs tracking-wide text-ink-muted uppercase">Tone</legend>
					<div class="mt-1 flex flex-col gap-1">
						{#each TONES as tone (tone)}
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									class="accent-accent"
									checked={recipe.filters.tone.includes(tone)}
									onchange={(e) =>
										generator.setFilter(
											'tone',
											toggleIn(recipe.filters.tone, tone, e.currentTarget.checked)
										)}
								/>
								<span class="capitalize">{tone}</span>
								{#if preset.tone.includes(tone)}
									<span class="text-xs text-ink-muted">default</span>
								{/if}
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset>
					<legend class="text-xs tracking-wide text-ink-muted uppercase">Ancestries</legend>
					<div class="mt-1 flex flex-col gap-1">
						{#each preset.ancestries as a (a.id)}
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									class="accent-accent"
									checked={recipe.filters.ancestries.includes(a.id)}
									onchange={(e) =>
										generator.setFilter(
											'ancestries',
											toggleIn(recipe.filters.ancestries, a.id, e.currentTarget.checked)
										)}
								/>
								{PRESETS.ancestries[a.id]?.label ?? a.id}
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset>
					<legend class="text-xs tracking-wide text-ink-muted uppercase">Archetypes</legend>
					{#if recipe.tier >= 2}
						<div class="mt-1 flex flex-col gap-1">
							{#each generator.archetypes as a (a.id)}
								<label class="flex items-center gap-2">
									<input
										type="checkbox"
										class="accent-accent"
										checked={recipe.filters.archetypes.includes(a.id)}
										onchange={(e) =>
											generator.setFilter(
												'archetypes',
												toggleIn(recipe.filters.archetypes, a.id, e.currentTarget.checked)
											)}
									/>
									{a.label}
								</label>
							{/each}
						</div>
					{:else}
						<p class="mt-1 text-ink-muted">Combat and party NPCs only.</p>
					{/if}
				</fieldset>
			</div>
		</div>
	{/if}

	{#if generator.error}
		<p class="mt-4 rounded border border-danger p-3 text-danger" role="alert">{generator.error}</p>
	{/if}
	{#if generator.renderError}
		<p class="mt-4 rounded border border-danger p-3 text-danger" role="alert">
			{generator.renderError}
		</p>
	{/if}

	{#if party}
		<article class="mt-4 rounded-lg border border-border bg-surface-2 p-4" aria-live="polite">
			{@render cardActions()}
			<PartyCard
				{party}
				{compact}
				onroll={prefs.has('rollButtons') ? onRoll : undefined}
				onnotice={say}
			/>
			{#if prefs.has('rollButtons')}
				<p class="mt-2 min-h-5 font-mono text-sm" role="log" aria-label="Last roll" data-last-roll>
					{lastRoll}
				</p>
			{/if}
		</article>
	{/if}
	{#if npc && narrative}
		<article class="mt-4 rounded-lg border border-border bg-surface-2 p-4" aria-live="polite">
			{@render cardActions()}
			<header class="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
				<!-- Copy blurb sits after the name on wide screens and before the name's lock and reroll on
				     narrow ones; only one of the two is displayed. -->
				{#snippet copyBlurbButton(placement: string)}
					<button
						type="button"
						class="rounded p-1.5 text-ink-muted hover:bg-surface-3 hover:text-ink {placement}"
						aria-label="Copy blurb"
						title="Copy the name, the combat summary and the blurb as text"
						onclick={copyBlurb}
					>
						<Quote size={16} aria-hidden="true" />
					</button>
				{/snippet}
				<div class="min-w-0">
					<div class="flex flex-wrap items-baseline gap-x-3">
						<h2
							class="text-2xl font-semibold wrap-break-word"
							class:text-accent={generator.isLocked('name')}
						>
							{narrative.name.full}
						</h2>
						{#if !prefs.isHidden('pronouns')}
							<span class="text-ink-muted">{narrative.pronouns}</span>
						{/if}
						{@render copyBlurbButton('hidden self-center sm:block')}
					</div>
				</div>
				<div class="flex gap-0.5">
					{@render copyBlurbButton('sm:hidden')}
					<div class="flex gap-0.5" data-field="name">
						<LockReroll
							label="Name"
							locked={generator.isLocked('name')}
							onreroll={() => generator.reroll('name')}
							ontogglelock={() => generator.toggleLock('name')}
						/>
					</div>
				</div>
				<!-- The summary spans both columns, under the name buttons too. -->
				<p class="col-span-2 min-h-5 text-sm text-ink-muted">{headerSummary}</p>
			</header>
			<dl class="divide-y divide-border">
				{#each visibleRows as [field, label] (field)}
					<FieldRow
						{field}
						{label}
						value={display(field)}
						locked={generator.isLocked(field)}
						onreroll={() => generator.reroll(field)}
						ontogglelock={() => generator.toggleLock(field)}
					/>
				{/each}
			</dl>

			{#if block}
				<div class="mt-4">
					<StatBlock
						{block}
						{compact}
						isLocked={(f) => generator.isLocked(f)}
						onreroll={(f) => generator.reroll(f)}
						ontogglelock={(f) => generator.toggleLock(f)}
						onroll={prefs.has('rollButtons') ? onRoll : undefined}
						onoverride={(id, value) => generator.setOverride(id, value)}
					/>
					{#if prefs.has('rollButtons')}
						<p
							class="mt-2 min-h-5 font-mono text-sm"
							role="log"
							aria-label="Last roll"
							data-last-roll
						>
							{lastRoll}
						</p>
					{/if}
					{#if prefs.has('tracker')}
						<div class="mt-2">
							<Tracker />
						</div>
					{/if}
					<div class="mt-3 flex justify-end">
						<button
							type="button"
							class="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
							onclick={() => generator.promote()}
						>
							<Users size={16} aria-hidden="true" />
							Build a party around them
						</button>
					</div>
				</div>
			{:else}
				<div class="mt-4 flex justify-end">
					<button
						type="button"
						class="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-3"
						onclick={() => generator.promote()}
					>
						<ArrowUpCircle size={16} aria-hidden="true" />
						Promote to combat NPC
					</button>
				</div>
			{/if}
		</article>
	{/if}
	{#if (npc && narrative) || party}
		{#if prefs.has('shortcuts')}
			<p class="mt-3 text-xs text-ink-muted">
				Keys: <kbd class="rounded border border-border px-1">G</kbd> generate,
				<kbd class="rounded border border-border px-1">R</kbd> reroll the focused field,
				<kbd class="rounded border border-border px-1">L</kbd> lock it,
				<kbd class="rounded border border-border px-1">S</kbd> save.
			</p>
		{/if}
	{/if}
</section>
