<script lang="ts">
  import MetricCard from '$components/MetricCard.svelte';
  import { Bell, Shield, FileText } from 'lucide-svelte';

  export let data: {
    metrics: Array<{ label: string; value: string; detail: string }>;
    alerts: { activeReminders: number; activeTires: number; expiringDocuments: number };
  };
</script>

<svelte:head><title>Dashboard · Moto Track</title></svelte:head>

<section class="grid gap-8">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <p class="text-sm font-semibold uppercase tracking-wide text-signal mb-1">Dashboard</p>
      <h1 class="text-4xl font-black text-ink dark:text-white">Workspace Overview</h1>
      <p class="mt-2 max-w-2xl text-[var(--muted)]">
        Odometer, alerts, fuel cost, reminders, and setup progress across your active motorcycles.
      </p>
    </div>
  </div>

  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.metrics as metric}
      <MetricCard {...metric} />
    {/each}
  </div>

  <div class="grid gap-6 md:grid-cols-3">
    <article class="panel p-6 bg-[var(--bg)]/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
      <div class="absolute top-0 right-0 w-32 h-32 bg-signal/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-signal/15 text-signal flex items-center justify-center">
          <Bell class="w-5 h-5" />
        </div>
        <h2 class="font-bold text-lg">Active reminders</h2>
      </div>
      <p class="text-5xl font-black text-ink dark:text-white">{data.alerts.activeReminders}</p>
      <p class="mt-3 text-xs text-[var(--muted)]">Due/soon evaluation is handled automatically by the system worker.</p>
    </article>
    
    <article class="panel p-6 bg-[var(--bg)]/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
      <div class="absolute top-0 right-0 w-32 h-32 bg-moss/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-moss/15 text-moss flex items-center justify-center">
          <Shield class="w-5 h-5" />
        </div>
        <h2 class="font-bold text-lg">Active tires</h2>
      </div>
      <p class="text-5xl font-black text-ink dark:text-white">{data.alerts.activeTires}</p>
      <p class="mt-3 text-xs text-[var(--muted)]">Wear and replacement indicators feed into the overall health scoring.</p>
    </article>
    
    <article class="panel p-6 bg-[var(--bg)]/40 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 relative overflow-hidden group">
      <div class="absolute top-0 right-0 w-32 h-32 bg-steel/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-steel/15 text-steel flex items-center justify-center">
          <FileText class="w-5 h-5" />
        </div>
        <h2 class="font-bold text-lg">Tracked documents</h2>
      </div>
      <p class="text-5xl font-black text-ink dark:text-white">{data.alerts.expiringDocuments}</p>
      <p class="mt-3 text-xs text-[var(--muted)]">Expiration dates will automatically generate reminders when nearing the deadline.</p>
    </article>
  </div>
</section>
