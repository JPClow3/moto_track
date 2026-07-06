<script lang="ts">
  export let data: { share: Record<string, unknown> };
</script>
<svelte:head><title>Public Sale Report · Moto Track</title></svelte:head>
<article class="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <p class="text-sm font-semibold uppercase tracking-wide text-signal">Sale Report</p>
  <h1 class="mt-3 text-4xl font-black">Motorcycle history dossier</h1>
  <div class="panel mt-8 p-5">
    <pre class="overflow-auto text-sm">{JSON.stringify(data.share.motorcycles ?? data.share, null, 2)}</pre>
  </div>
</article>
