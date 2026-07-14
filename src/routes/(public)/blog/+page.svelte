<script lang="ts">
  export let data: { articles: Array<{ title: string; slug: string; summary: string; published_at: string }> };
</script>
<svelte:head><title>Blog · Moto Track</title></svelte:head>
<section class="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <h1 class="text-4xl font-black">Blog</h1>
  <div class="mt-8 grid gap-4">
    {#each data.articles as article}
      <a class="panel block p-5" href={`/blog/${article.slug}`}>
        <h2 class="text-xl font-bold">{article.title}</h2>
        <p class="mt-2 text-sm text-[var(--muted)]">{article.summary}</p>
      </a>
    {:else}
      <p class="text-[var(--muted)]">Sem artigos publicados.</p>
    {/each}
  </div>
</section>
