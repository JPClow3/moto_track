<script lang="ts">
  import MetricCard from '$components/MetricCard.svelte';
  import { Bell, CircleGauge, FileText } from 'lucide-svelte';

  export let data: {
    metrics: Array<{ label: string; value: string; detail: string }>;
    alerts: { activeReminders: number; activeTires: number; expiringDocuments: number };
  };

  $: alerts = [
    {
      icon: Bell,
      title: 'Lembretes ativos',
      value: data.alerts.activeReminders,
      detail: 'O worker avalia automaticamente o que está vencido ou próximo.',
      // The only one that asks for action, so the only one in red.
      accent: true
    },
    {
      icon: CircleGauge,
      title: 'Pneus ativos',
      value: data.alerts.activeTires,
      detail: 'Desgaste e troca alimentam a nota de saúde da moto.',
      accent: false
    },
    {
      icon: FileText,
      title: 'Documentos monitorados',
      value: data.alerts.expiringDocuments,
      detail: 'Datas de validade viram lembretes conforme o prazo se aproxima.',
      accent: false
    }
  ];
</script>

<svelte:head><title>Painel · Moto Track</title></svelte:head>

<section class="grid gap-8">
  <div>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>
      Painel
    </p>
    <h1 class="display mt-3 text-5xl">Central da garagem</h1>
    <p class="mt-3 max-w-2xl text-[var(--muted)]">
      Odômetro, alertas, custo de combustível e lembretes das suas motos ativas.
    </p>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.metrics as metric}
      <MetricCard {...metric} />
    {/each}
  </div>

  <div class="grid gap-4 md:grid-cols-3">
    {#each alerts as alert (alert.title)}
      <article class="panel p-6">
        <div class="mb-5 flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-sm"
            class:accent-chip={alert.accent}
            class:muted-chip={!alert.accent}
          >
            <svelte:component this={alert.icon} class="h-4 w-4" />
          </div>
          <h2 class="label-tech text-[var(--muted)]">{alert.title}</h2>
        </div>
        <p class="display numeric text-6xl">{alert.value}</p>
        <p class="mt-3 text-xs leading-relaxed text-[var(--muted)]">{alert.detail}</p>
      </article>
    {/each}
  </div>
</section>

<style>
  .accent-chip {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .muted-chip {
    background: color-mix(in srgb, var(--fg) 6%, transparent);
    color: var(--muted);
  }
</style>
