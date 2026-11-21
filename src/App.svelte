<script lang="ts">
	import { router } from './data/router.svelte';
	import Shell from './ui/shell/Shell.svelte';
	import Generate from './ui/generate/Generate.svelte';
	import Settings from './ui/settings/Settings.svelte';
	import Tools from './ui/tools/Tools.svelte';
	import Library from './ui/library/Library.svelte';
	import RecordView from './ui/library/RecordView.svelte';
	import PrintView from './ui/library/PrintView.svelte';
	import Editor from './ui/editor/Editor.svelte';

	const route = $derived(router.route);
</script>

<Shell {route}>
	{#if route.screen === 'generate'}
		<Generate />
	{:else if route.screen === 'shared'}
		<Generate shareCode={route.code} />
	{:else if route.screen === 'settings'}
		<Settings />
	{:else if route.screen === 'library'}
		<Library />
	{:else if route.screen === 'npc' || route.screen === 'party'}
		{#key route.id}
			<RecordView kind={route.screen} id={route.id} />
		{/key}
	{:else if route.screen === 'print'}
		<PrintView kind={route.kind} ids={route.ids} />
	{:else if route.screen === 'editor'}
		<Editor />
	{:else if route.screen === 'tools'}
		<Tools />
	{/if}
</Shell>
