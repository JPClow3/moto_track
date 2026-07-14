<script lang="ts">
  import MetricCard from '$components/MetricCard.svelte';

  export let data: {
    metrics: Array<{ label: string; value: string; detail: string }>;
    alerts: { activeReminders: number; activeTires: number; expiringDocuments: number };
  };
</script>

<svelte:head><title>Dashboard · Moto Track</title></svelte:head>

<section class="grid gap-6">
  <div>
    <p class="text-sm font-semibold uppercase tracking-wide text-signal">Dashboard</p>
    <h1 class="text-3xl font-bold">Live motorcycle overview</h1>
    <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">
      Odometer, alerts, fuel cost, reminders, and setup progress across your active motorcycles.
    </p>
  </div>

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {#each data.metrics as metric}
      <MetricCard {...metric} />
    {/each}
  </div>

  <div class="grid gap-4 lg:grid-cols-3">
    <article class="panel p-5">
      <h2 class="font-semibold">Active reminders</h2>
      <p class="mt-4 text-4xl font-black">{data.alerts.activeReminders}</p>
      <p class="mt-2 text-sm text-[var(--muted)]">Due/soon evaluation is handled server-side and by the scheduled worker.</p>
    </article>
    <article class="panel p-5">
      <h2 class="font-semibold">Active tires</h2>
      <p class="mt-4 text-4xl font-black">{data.alerts.activeTires}</p>
      <p class="mt-2 text-sm text-[var(--muted)]">Wear and replacement indicators feed health scoring.</p>
    </article>
    <article class="panel p-5">
      <h2 class="font-semibold">Tracked documents</h2>
      <p class="mt-4 text-4xl font-black">{data.alerts.expiringDocuments}</p>
      <p class="mt-2 text-sm text-[var(--muted)]">Expiration dates can create reminders automatically.</p>
    </article>
  </div>
</section>
