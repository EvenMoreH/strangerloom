<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dices, Library, Settings, SlidersHorizontal, Wrench } from '@lucide/svelte';
	import type { Route } from '../../data/router.svelte';
	import { routeToHash } from '../../data/router.svelte';
	import { APP_VERSION } from '../../version';
	import { prefs } from '../../data/prefs.svelte';

	let { route, children }: { route: Route; children: Snippet } = $props();

	const items: { label: string; screen: Route['screen']; hash: string; icon: typeof Dices }[] = [
		{
			label: 'Generate',
			screen: 'generate',
			hash: routeToHash({ screen: 'generate' }),
			icon: Dices
		},
		{
			label: 'Library',
			screen: 'library',
			hash: routeToHash({ screen: 'library' }),
			icon: Library
		},
		{ label: 'Tools', screen: 'tools', hash: routeToHash({ screen: 'tools' }), icon: Wrench },
		{
			label: 'Editor',
			screen: 'editor',
			hash: routeToHash({ screen: 'editor' }),
			icon: SlidersHorizontal
		},
		{
			label: 'Settings',
			screen: 'settings',
			hash: routeToHash({ screen: 'settings' }),
			icon: Settings
		}
	];

	const generateScreens = new Set<Route['screen']>(['generate', 'shared']);
	const libraryScreens = new Set<Route['screen']>(['library', 'npc', 'party']);
	function isActive(screen: Route['screen']) {
		if (screen === 'generate') return generateScreens.has(route.screen);
		if (screen === 'library') return libraryScreens.has(route.screen);
		return route.screen === screen;
	}
</script>

<div class="flex min-h-full flex-col">
	<header
		class="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-2 print:hidden"
		style="padding-top: max(0.5rem, env(safe-area-inset-top))"
	>
		<a
			href={routeToHash({ screen: 'generate' })}
			class="flex items-center gap-2 font-display font-semibold pointer-coarse:min-h-11"
		>
			<img src="favicon.svg" alt="" width="24" height="24" class="rounded" />
			Strangerloom
		</a>
		<nav class="ml-auto hidden gap-1 sm:flex" aria-label="Main">
			{#each items as item (item.screen)}
				<a
					href={item.hash}
					aria-current={isActive(item.screen) ? 'page' : undefined}
					class="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm hover:bg-surface-3 aria-[current=page]:bg-surface-3 aria-[current=page]:font-medium"
				>
					<item.icon size={16} aria-hidden="true" />
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<main class="flex-1 pb-20 sm:pb-0 print:pb-0">
		{#if !prefs.storageNoticeSeen}
			<aside
				class="mx-4 mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm print:hidden"
				aria-label="Your library stays on this device"
			>
				<div class="min-w-0 flex-1">
					<h2 class="font-medium">Your library stays on this device</h2>
					<p class="mt-1 text-ink-muted">
						Strangerloom has no account and no server. Saved NPCs, parties and packs live in this
						browser only, so clearing site data or switching browser or device removes them. Use
						Export backup in the Library to keep a file, and Import to restore it.
					</p>
				</div>
				<button
					type="button"
					class="rounded border border-border px-3 py-1.5 hover:bg-surface-3"
					onclick={() => prefs.dismissStorageNotice()}>Got it</button
				>
			</aside>
		{/if}
		{@render children()}
	</main>

	<nav
		class="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface-2 sm:hidden print:hidden"
		style="padding-bottom: env(safe-area-inset-bottom)"
		aria-label="Main"
	>
		{#each items as item (item.screen)}
			<a
				href={item.hash}
				aria-current={isActive(item.screen) ? 'page' : undefined}
				class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-ink-muted aria-[current=page]:text-accent"
			>
				<item.icon size={20} aria-hidden="true" />
				{item.label}
			</a>
		{/each}
	</nav>

	<footer class="hidden px-4 py-2 text-xs text-ink-muted sm:block print:hidden">
		Strangerloom {APP_VERSION}
	</footer>
</div>
