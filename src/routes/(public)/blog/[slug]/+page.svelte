<script lang="ts">
  export let data: { article: Record<string, string> };
</script>
<svelte:head><title>{data.article.title} · Moto Track</title></svelte:head>
<article class="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <h1 class="text-4xl font-black">{data.article.title}</h1>
  <p class="mt-4 text-lg text-[var(--muted)]">{data.article.summary}</p>
  <div class="prose mt-8 max-w-none whitespace-pre-wrap dark:prose-invert">{data.article.body}</div>
</article>
