<script lang="ts">
	import { DARK_THEMES, LIGHT_THEMES, THEMES, type ThemeChoice } from '../../engine/themes';
	import { FEATURE_IDS, FEATURES, prefs } from '../../data/prefs.svelte';

	const groups = [
		{ label: 'Light', themes: LIGHT_THEMES },
		{ label: 'Dark', themes: DARK_THEMES }
	];
</script>

<section class="mx-auto max-w-3xl p-4" aria-labelledby="settings-title">
	<h1 id="settings-title" class="text-xl font-semibold">Settings</h1>

	<fieldset class="mt-6">
		<legend class="font-display font-medium">Theme</legend>
		<div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#if prefs.offersFollow}
				{@render option('follow', 'Follow TallyHo')}
			{/if}
			{@render option('system', 'Match system')}
		</div>
		{#each groups as group (group.label)}
			<fieldset class="mt-4">
				<legend class="text-xs font-medium tracking-wide text-ink-muted uppercase">
					{group.label}
				</legend>
				<div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each group.themes as id (id)}
						{@render option(id, THEMES[id].label)}
					{/each}
				</div>
			</fieldset>
		{/each}
	</fieldset>

	<fieldset class="mt-6">
		<legend class="font-display font-medium">Combat NPC view</legend>
		<p class="mt-1 text-sm text-ink-muted">
			The view a combat NPC opens in. The Full/Compact switch on the card switches it for the
			current NPC.
		</p>
		<div class="mt-2 flex gap-2">
			{#each [['full', 'Full'], ['compact', 'Compact']] as const as [view, label] (view)}
				<label
					class="flex cursor-pointer items-center gap-2 rounded border border-border bg-surface px-3 py-2 has-checked:border-accent has-checked:ring-2 has-checked:ring-accent"
				>
					<input
						type="radio"
						name="default-view"
						value={view}
						checked={prefs.defaultView === view}
						onchange={() => prefs.setDefaultView(view)}
						class="accent-accent"
					/>
					{label}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class="mt-6">
		<legend class="font-display font-medium">Features</legend>
		<p class="mt-1 text-sm text-ink-muted">ON/OFF what you do not use at the table.</p>
		<div class="mt-2 flex flex-col gap-1">
			{#each FEATURE_IDS as feature (feature)}
				<label class="flex min-h-9 items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="accent-accent"
						checked={prefs.has(feature)}
						onchange={(e) => prefs.setFeature(feature, e.currentTarget.checked)}
					/>
					{FEATURES[feature]}
				</label>
			{/each}
		</div>
	</fieldset>
</section>

<!-- One theme as a live preview: the tile carries the theme, so it shows that theme's page, text, accent and
     heading font whatever theme the page has. "Match system" shows the page's own colours, "Follow TallyHo" the
     theme TallyHo sent last (offered inside TallyHo's frame only). -->
{#snippet option(choice: ThemeChoice | 'follow', label: string)}
	{@const tile = choice === 'follow' ? (prefs.embedTheme ?? undefined) : choice}
	<label
		data-theme={tile === 'system' ? undefined : tile}
		class="flex cursor-pointer items-center gap-2 rounded border border-border bg-surface p-3 text-ink has-checked:border-accent has-checked:ring-2 has-checked:ring-accent"
	>
		<input
			type="radio"
			name="theme"
			value={choice}
			checked={choice === 'follow' ? prefs.following : !prefs.following && prefs.theme === choice}
			onchange={() => (choice === 'follow' ? prefs.followEmbedder() : prefs.setTheme(choice))}
			class="accent-accent"
		/>
		<span class="flex-1" class:font-display={choice !== 'system'}>{label}</span>
		<span class="flex gap-1" aria-hidden="true">
			<span class="h-4 w-4 rounded-full bg-accent"></span>
			<span class="h-4 w-4 rounded-full border border-border-strong bg-surface-3"></span>
		</span>
	</label>
{/snippet}
