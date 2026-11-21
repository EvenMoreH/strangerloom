<script lang="ts">
	import { Bookmark, ClipboardCopy, Copy, Dices, Ellipsis, Quote } from '@lucide/svelte';
	import type { StatBlock } from '../../engine/adapter';
	import { tallyhoText } from '../../engine/export';
	import { standaloneMemberRecipe } from '../../engine/party';
	import type { Party, Recipe } from '../../engine/schema';
	import { generator } from '../../data/generator.svelte';
	import { library } from '../../data/library.svelte';
	import { prefs } from '../../data/prefs.svelte';
	import { router } from '../../data/router.svelte';
	import { blurbText, npcPlainText, textOptionsOf } from '../generate/display';

	/**
	 * The "⋯" menu of one party member: take the member out of the party as a standalone combat NPC (save it, copy
	 * it, or open it in the generator). The member's own recipe regenerates it without the party.
	 */
	let {
		party,
		recipe,
		index,
		block,
		onnotice
	}: {
		party: Party;
		recipe: Recipe;
		index: number;
		block: StatBlock | null;
		onnotice?: (text: string) => void;
	} = $props();

	let open = $state(false);
	let root: HTMLElement | undefined = $state();
	const member = $derived(party.members[index]);
	const name = $derived(member.narrative.name.full);
	const hidden = (f: Parameters<typeof prefs.isHidden>[0]) => prefs.isHidden(f);

	function say(text: string) {
		onnotice?.(text);
		open = false;
	}
	async function save() {
		try {
			await library.saveNpc(standaloneMemberRecipe(recipe, party, index), member);
			say(`${name} saved as an NPC`);
		} catch (err) {
			say(`Not saved: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	async function copyText() {
		await navigator.clipboard.writeText(
			npcPlainText(member.narrative, block, hidden, recipe.preset)
		);
		say(`${name} copied`);
	}
	async function copyBlurb() {
		await navigator.clipboard.writeText(
			blurbText(member, hidden, recipe.preset, index === party.leaderIndex)
		);
		say(`${name}'s blurb copied`);
	}
	async function copyTallyho() {
		await navigator.clipboard.writeText(
			tallyhoText(member, block, textOptionsOf(member.narrative, hidden, recipe.preset))
		);
		say(`${name} copied for TallyHo`);
	}
	function openAlone() {
		open = false;
		generator.loadRecord(standaloneMemberRecipe(recipe, party, index));
		router.go({ screen: 'generate' });
		window.scrollTo({ top: 0 });
	}
	function onWindowClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			e.stopPropagation();
		}
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="relative" bind:this={root} onkeydown={onKey} role="presentation">
	<button
		type="button"
		class="rounded p-1.5 text-ink-muted hover:bg-surface-3 hover:text-ink aria-expanded:bg-surface-3"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={`More actions for ${name}`}
		title="Save, copy or open this member on its own"
		onclick={() => (open = !open)}
	>
		<Ellipsis size={14} aria-hidden="true" />
	</button>
	{#if open}
		<div
			class="absolute top-full right-0 z-20 mt-1 flex w-56 flex-col rounded-lg border border-border bg-surface p-1 text-sm shadow-md"
			role="menu"
			aria-label={`Actions for ${name}`}
		>
			<button
				type="button"
				role="menuitem"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-3"
				onclick={save}
			>
				<Bookmark size={14} aria-hidden="true" /> Save as NPC
			</button>
			<button
				type="button"
				role="menuitem"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-3"
				onclick={copyText}
			>
				<Copy size={14} aria-hidden="true" /> Copy as text
			</button>
			<button
				type="button"
				role="menuitem"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-3"
				onclick={copyBlurb}
			>
				<Quote size={14} aria-hidden="true" /> Copy blurb
			</button>
			<button
				type="button"
				role="menuitem"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-3"
				onclick={copyTallyho}
			>
				<ClipboardCopy size={14} aria-hidden="true" /> Copy for TallyHo
			</button>
			<button
				type="button"
				role="menuitem"
				class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-3"
				onclick={openAlone}
			>
				<Dices size={14} aria-hidden="true" /> Open as combat NPC
			</button>
		</div>
	{/if}
</div>
