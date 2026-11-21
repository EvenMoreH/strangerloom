<script lang="ts">
	let { title, text }: { title: string; text: string } = $props();
</script>

<section class="mx-auto max-w-xl p-6 text-center" aria-labelledby="placeholder-title">
	<h1 id="placeholder-title" class="text-xl font-semibold">{title}</h1>
	<p class="mt-2 text-ink-muted">{text}</p>
</section>
