<script lang="ts">
  import MetricCard from '$components/MetricCard.svelte';
  export let data: { isStaff: boolean; counts: Record<string, number | null> };
</script>
<svelte:head><title>Admin · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <div>
    <p class="text-sm font-semibold uppercase tracking-wide text-signal">Admin</p>
    <h1 class="text-3xl font-bold">Operations console</h1>
    <p class="mt-2 text-sm text-[var(--muted)]">SvelteKit replacement for Django admin surfaces.</p>
  </div>
  {#if !data.isStaff}
    <div class="panel p-5 text-danger">Your profile is not marked as staff.</div>
  {/if}
  <div class="grid gap-4 md:grid-cols-4">
    <MetricCard label="Users" value={String(data.counts.users ?? 0)} />
    <MetricCard label="Articles" value={String(data.counts.articles ?? 0)} />
    <MetricCard label="Billing events" value={String(data.counts.events ?? 0)} />
    <MetricCard label="Data requests" value={String(data.counts.requests ?? 0)} />
  </div>
</section>
