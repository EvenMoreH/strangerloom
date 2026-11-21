<script lang="ts">
	import { ChevronRight, Plus, Trash2 } from '@lucide/svelte';
	import { library, type SavedRecord } from '../../data/library.svelte';

	/** The record's chronicle: dated entries, folded to one line until opened. */
	let { record, onnotice }: { record: SavedRecord; onnotice?: (text: string) => void } = $props();

	let open = $state(false);
	let label = $state('');
	let text = $state('');

	// Records saved before the chronicle existed carry no list.
	const entries = $derived([...(record.chronicle ?? [])].sort((a, b) => b.at.localeCompare(a.at)));
	const day = (iso: string) => new Date(iso).toLocaleDateString();
	const last = $derived(entries[0]);

	/** Grows a textarea with its content: as many lines as typed, never a scrollbar inside the box. */
	function autogrow(el: HTMLTextAreaElement, value: string) {
		const fit = () => {
			el.style.height = 'auto';
			el.style.height = `${el.scrollHeight}px`;
		};
		void value;
		fit();
		el.addEventListener('input', fit);
		const observer = new ResizeObserver(fit);
		observer.observe(el);
		return {
			// Runs when the bound value changes from outside typing, such as the box being cleared after Add.
			update: (next: string) => {
				void next;
				requestAnimationFrame(fit);
			},
			destroy: () => {
				el.removeEventListener('input', fit);
				observer.disconnect();
			}
		};
	}

	async function add() {
		if (!text.trim()) return;
		await library.addChronicle(record, text, label);
		text = '';
		onnotice?.('Chronicle entry added');
	}
</script>

<section class="mt-3 print:hidden" aria-labelledby="chronicle-title">
	<button
		type="button"
		class="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm hover:bg-surface-3"
		aria-expanded={open}
		aria-controls="chronicle-body"
		onclick={() => (open = !open)}
	>
		<ChevronRight
			size={16}
			aria-hidden="true"
			class="shrink-0 transition-transform {open ? 'rotate-90' : ''}"
		/>
		<span id="chronicle-title" class="font-medium">Chronicle</span>
		<span class="text-ink-muted tabular-nums" data-chronicle-summary>
			{#if entries.length === 0}
				no entries yet
			{:else}
				{entries.length}
				{entries.length === 1 ? 'entry' : 'entries'} | last {day(last.at)}{last.label
					? `, ${last.label}`
					: ''}
			{/if}
		</span>
	</button>
	{#if open}
		<div id="chronicle-body" class="mt-1 rounded border border-border bg-surface p-3">
			<form
				class="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
				onsubmit={(e) => {
					e.preventDefault();
					add();
				}}
			>
				<input
					class="self-start rounded border border-border bg-surface px-2 py-1.5 text-sm"
					placeholder="Session 4"
					aria-label="Chronicle label"
					bind:value={label}
				/>
				<textarea
					class="resize-none overflow-hidden rounded border border-border bg-surface px-2 py-1.5 text-sm"
					rows="2"
					placeholder="What happened"
					aria-label="Chronicle entry"
					bind:value={text}
					use:autogrow={text}
					onkeydown={(e) => {
						if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add();
					}}></textarea>
				<button
					type="submit"
					class="flex items-center gap-1 self-start rounded bg-accent-fill px-3 py-1.5 text-sm text-accent-ink glow disabled:opacity-50"
					disabled={!text.trim()}
				>
					<Plus size={14} aria-hidden="true" /> Add entry
				</button>
			</form>
			{#if entries.length}
				<ol class="mt-3 divide-y divide-border" aria-label="Chronicle entries">
					{#each entries as e (e.id)}
						<li class="flex gap-2 py-2 text-sm" data-chronicle-entry>
							<div class="w-28 shrink-0 text-xs text-ink-muted">
								<time datetime={e.at}>{day(e.at)}</time>
								<input
									class="mt-0.5 block w-full rounded border border-transparent bg-transparent px-1 text-xs hover:border-border focus:border-border"
									value={e.label}
									placeholder="label"
									aria-label="Label of entry {day(e.at)}"
									onchange={(ev) =>
										library.editChronicle(record, e.id, { label: ev.currentTarget.value.trim() })}
								/>
							</div>
							<textarea
								class="flex-1 resize-none overflow-hidden rounded border border-transparent bg-transparent px-1 hover:border-border focus:border-border"
								rows="1"
								value={e.text}
								use:autogrow={e.text}
								aria-label="Entry {day(e.at)}"
								onchange={(ev) =>
									library.editChronicle(record, e.id, { text: ev.currentTarget.value.trim() })}
							></textarea>
							<button
								type="button"
								class="self-start rounded p-1 text-ink-muted hover:bg-surface-3 hover:text-danger"
								aria-label="Remove entry {day(e.at)}"
								onclick={() => library.removeChronicle(record, e.id)}
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}
</section>
