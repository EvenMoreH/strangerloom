<script lang="ts">
	import { Dices, HeartPulse, Minus, Plus, RotateCcw } from '@lucide/svelte';
	import { tracker } from '../../data/tracker.svelte';
	import { isBloodied, isDown } from '../../engine/tracker';
	import { words } from '../../engine/adapter';

	let amount = $state(1);

	const t = $derived(tracker.state);
	const hint = $derived(tracker.hint);
	const hasHp = $derived(t.hpMax > 0);
	const status = $derived(isDown(t) ? 'Down' : isBloodied(t) ? 'Bloodied' : '');

	const step = () => (Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 1);
</script>

<section
	class="rounded-lg border border-border bg-surface p-3"
	aria-label="Tracker"
	data-section="tracker"
>
	<div class="flex flex-wrap items-center gap-2">
		<h3 class="text-xs font-medium tracking-wide text-ink-muted uppercase">Tracker</h3>
		{#if status}
			<span
				class="rounded px-1.5 py-0.5 text-xs font-medium"
				class:bg-danger={status === 'Down'}
				class:text-surface={status === 'Down'}
				class:bg-surface-3={status !== 'Down'}
				role="status"
				data-status={status}>{status}</span
			>
		{/if}
		<div class="ml-auto flex items-center gap-1">
			{#if hint.hpRoll}
				<button
					type="button"
					class="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-surface-3"
					title={`Roll hit points (${hint.hpRoll})`}
					onclick={() => tracker.rollHp()}
				>
					<Dices size={14} aria-hidden="true" />
					Roll HP
				</button>
			{/if}
			<button
				type="button"
				class="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-surface-3"
				onclick={() => tracker.reset()}
			>
				<RotateCcw size={14} aria-hidden="true" />
				Reset
			</button>
		</div>
	</div>

	<div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
		<HeartPulse size={18} class="text-danger" aria-hidden="true" />
		<label class="flex items-center gap-1">
			<span class="sr-only">Current hit points</span>
			<input
				type="number"
				min="0"
				max={t.hpMax}
				class="w-16 rounded border border-border bg-surface px-2 py-1 text-center font-mono"
				value={t.hp}
				onchange={(e) => tracker.setHp(Number(e.currentTarget.value))}
				aria-label="Current hit points"
			/>
		</label>
		<span class="text-ink-muted">/</span>
		<label class="flex items-center gap-1">
			<input
				type="number"
				min="0"
				max="9999"
				class="w-16 rounded border border-border bg-surface px-2 py-1 text-center font-mono"
				value={t.hpMax}
				placeholder="max"
				onchange={(e) => tracker.setHpMax(Number(e.currentTarget.value))}
				aria-label="Maximum hit points"
			/>
		</label>
		{#if hasHp}
			<div class="flex items-center gap-1" role="group" aria-label="Damage and healing">
				<button
					type="button"
					class="flex min-h-9 min-w-9 items-center justify-center rounded border border-border hover:bg-surface-3"
					aria-label={`Damage ${step()}`}
					onclick={() => tracker.damage(step())}
				>
					<Minus size={16} aria-hidden="true" />
				</button>
				<input
					type="number"
					min="1"
					class="w-14 rounded border border-border bg-surface px-2 py-1 text-center font-mono"
					bind:value={amount}
					aria-label="Amount"
				/>
				<button
					type="button"
					class="flex min-h-9 min-w-9 items-center justify-center rounded border border-border hover:bg-surface-3"
					aria-label={`Heal ${step()}`}
					onclick={() => tracker.heal(step())}
				>
					<Plus size={16} aria-hidden="true" />
				</button>
			</div>
			<div
				class="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-3"
				role="progressbar"
				aria-label="Hit points"
				aria-valuemin="0"
				aria-valuemax={t.hpMax}
				aria-valuenow={t.hp}
			>
				<div
					class="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none"
					class:bg-danger={isBloodied(t)}
					style={`width: ${t.hpMax ? (100 * t.hp) / t.hpMax : 0}%`}
				></div>
			</div>
		{:else}
			<span class="text-ink-muted">Enter a maximum to track hit points.</span>
		{/if}
	</div>

	{#if hint.conditions.length}
		<ul class="mt-2 flex flex-wrap gap-1" aria-label="Conditions">
			{#each hint.conditions as c (c)}
				<li>
					<button
						type="button"
						class="min-h-8 rounded-full border border-border px-2.5 py-0.5 text-xs hover:bg-surface-3 aria-pressed:border-accent aria-pressed:bg-accent-fill aria-pressed:text-accent-ink aria-pressed:glow"
						aria-pressed={t.conditions.includes(c)}
						onclick={() => tracker.toggle(c)}
					>
						{words(c)}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
