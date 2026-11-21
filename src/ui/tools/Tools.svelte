<script lang="ts">
	import DiceRoller from './DiceRoller.svelte';
	import RollLog from './RollLog.svelte';
</script>

<section class="mx-auto max-w-3xl space-y-4 p-4" aria-labelledby="tools-title">
	<h1 id="tools-title" class="sr-only">Tools</h1>
	<DiceRoller />
	<RollLog />
</section>
