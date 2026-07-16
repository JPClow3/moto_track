<script lang="ts">
  import MetricCard from '$components/MetricCard.svelte';
  import HealthGauge from '$components/charts/HealthGauge.svelte';
  import TrendChart from '$components/charts/TrendChart.svelte';
  import CostDonut from '$components/charts/CostDonut.svelte';
  import ActivityHeatmap from '$components/charts/ActivityHeatmap.svelte';
  import SpendBars from '$components/charts/SpendBars.svelte';
  import { ArrowRight, Bell, Fuel, TriangleAlert } from 'lucide-svelte';

  export let data;

  const STATUS_LABEL = {
    overdue: 'Vencido',
    due_soon: 'Em breve',
    ok: 'Em dia',
    unknown: '—'
  } as const;

  $: consumption = data.consumption ?? [];
  $: latestConsumption = consumption[consumption.length - 1]?.value ?? null;
  $: previousConsumption = consumption[consumption.length - 2]?.value ?? null;
  // Higher km/L is better, so an increase is a win worth calling out.
  $: consumptionDelta =
    latestConsumption !== null && previousConsumption
      ? Math.round(((latestConsumption - previousConsumption) / previousConsumption) * 1000) / 10
      : null;

  $: hasSpend = (data.spend ?? []).some((entry) => entry.cents > 0);
  $: hasActivity = (data.activity ?? []).some((cell) => cell.count > 0);
</script>

<svelte:head><title>Painel · Moto Track</title></svelte:head>

<section class="grid gap-6">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>
        Painel
      </p>
      <h1 class="display mt-3 text-5xl">Central da garagem</h1>
      <p class="live mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
        <span class="live-dot" aria-hidden="true"></span>
        Dados sincronizados · {new Date(`${data.today}T00:00:00.000Z`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC'
        })}
      </p>
    </div>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.metrics as metric (metric.label)}
      <MetricCard {...metric} />
    {/each}
  </div>

  <!-- Telemetry + health -->
  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <article class="panel p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="display text-2xl">Consumo</h2>
          <p class="mt-1 text-sm text-[var(--muted)]">km/L entre tanques cheios</p>
        </div>
        {#if latestConsumption !== null}
          <div class="text-right">
            <p class="display numeric text-4xl text-[var(--accent)]">{latestConsumption.toFixed(1)}</p>
            <p class="label-tech text-[var(--muted)]">
              km/L
              {#if consumptionDelta !== null && consumptionDelta !== 0}
                <span class:up={consumptionDelta > 0} class:down={consumptionDelta < 0}>
                  {consumptionDelta > 0 ? '▲' : '▼'} {Math.abs(consumptionDelta).toFixed(1)}%
                </span>
              {/if}
            </p>
          </div>
        {/if}
      </div>

      {#if consumption.length > 1}
        <div class="mt-4">
          <TrendChart points={consumption} unit="km/L" />
        </div>
      {:else}
        <div class="mt-6 flex flex-col items-center justify-center gap-3 py-14 text-center">
          <Fuel class="h-6 w-6 text-[var(--accent)]" />
          <p class="label-tech text-[var(--accent)]">Sem leituras suficientes</p>
          <p class="max-w-xs text-sm text-[var(--muted)]">
            Registre pelo menos dois abastecimentos de tanque cheio para o consumo aparecer aqui.
          </p>
          <a class="button-secondary mt-1" href="/fuel">Registrar abastecimento</a>
        </div>
      {/if}
    </article>

    <article class="panel relative overflow-hidden p-6">
      <div class="corner-slashes" aria-hidden="true"></div>
      <div class="relative">
        <h2 class="display text-2xl">Saúde</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">
          {#if data.healthMotorcycle}
            Pior da garagem · {data.healthMotorcycle}
          {:else}
            Lembretes, pneus e documentos
          {/if}
        </p>

        {#if data.health}
          <div class="mt-5">
            <HealthGauge score={data.health.total} status={data.health.readable_status} />
          </div>

          <ul class="mt-5 grid gap-2 border-t border-[var(--line)] pt-4">
            {#each data.upcoming as reminder (reminder.id)}
              <li class="flex items-center gap-3 text-sm">
                <span
                  class="tick"
                  class:tick--accent={reminder.status === 'overdue'}
                  aria-hidden="true"
                ></span>
                <span class="flex-1 truncate">{reminder.title}</span>
                <span
                  class="label-tech shrink-0 text-[10px] {reminder.status === 'overdue'
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--muted)]'}"
                >
                  {#if reminder.remainingKm !== null && reminder.status !== 'ok'}
                    {reminder.remainingKm <= 0 ? STATUS_LABEL.overdue : `${reminder.remainingKm} km`}
                  {:else if reminder.remainingDays !== null && reminder.status !== 'ok'}
                    {reminder.remainingDays <= 0 ? STATUS_LABEL.overdue : `${reminder.remainingDays} d`}
                  {:else}
                    {STATUS_LABEL[reminder.status]}
                  {/if}
                </span>
              </li>
            {:else}
              <li class="py-2 text-sm text-[var(--muted)]">Nenhum lembrete ativo.</li>
            {/each}
          </ul>
          <a class="button-secondary mt-4 w-full" href="/reminders">
            <Bell class="h-3.5 w-3.5" /> Ver lembretes
          </a>
        {:else}
          <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <TriangleAlert class="h-6 w-6 text-[var(--accent)]" />
            <p class="label-tech text-[var(--accent)]">Garagem vazia</p>
            <p class="max-w-[15rem] text-sm text-[var(--muted)]">
              Cadastre uma moto para calcular a nota de saúde.
            </p>
            <a class="button-primary mt-1" href="/garage">Cadastrar moto</a>
          </div>
        {/if}
      </div>
    </article>
  </div>

  <!-- Activity + costs -->
  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <article class="panel p-6">
      <h2 class="display text-2xl">Atividade</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">Registros nas últimas 18 semanas</p>
      <div class="mt-5">
        {#if hasActivity}
          <ActivityHeatmap cells={data.activity} />
        {:else}
          <p class="py-10 text-center text-sm text-[var(--muted)]">
            Nenhum registro ainda. Cada abastecimento, manutenção ou despesa aparece aqui.
          </p>
        {/if}
      </div>
    </article>

    <article class="panel p-6">
      <h2 class="display text-2xl">Custos</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">Histórico completo por categoria</p>
      <div class="mt-6">
        {#if data.costs.length}
          <CostDonut slices={data.costs} />
        {:else}
          <p class="py-10 text-center text-sm text-[var(--muted)]">
            Sem custos registrados até agora.
          </p>
        {/if}
      </div>
    </article>
  </div>

  <!-- Spend + garage -->
  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <article class="panel p-6">
      <h2 class="display text-2xl">Gasto mensal</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">Combustível, manutenção, pneus e taxas</p>
      <div class="mt-5">
        {#if hasSpend}
          <SpendBars months={data.spend} />
        {:else}
          <p class="py-10 text-center text-sm text-[var(--muted)]">
            Sem gastos nos últimos 6 meses.
          </p>
        {/if}
      </div>
    </article>

    <article class="panel p-6">
      <h2 class="display text-2xl">Garagem</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">Odômetro por moto</p>
      <ul class="mt-5 grid gap-1">
        {#each data.garage as motorcycle, i (motorcycle.id)}
          <li class="garage-row flex items-center gap-3 rounded px-2 py-2.5">
            <span class="label-tech numeric w-6 shrink-0 text-center text-[var(--muted)]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{motorcycle.name}</span>
              <span class="block truncate text-xs text-[var(--muted)]">{motorcycle.detail}</span>
            </span>
            <span class="shrink-0 text-right">
              <span class="numeric block text-sm font-semibold">
                {motorcycle.odometer.toLocaleString('pt-BR')} km
              </span>
              <span
                class="label-tech block text-[10px] {motorcycle.health.total < 50
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--muted)]'}"
              >
                Saúde {motorcycle.health.total}
              </span>
            </span>
          </li>
        {:else}
          <li class="py-8 text-center text-sm text-[var(--muted)]">Nenhuma moto ativa.</li>
        {/each}
      </ul>
      <a class="button-secondary mt-4 w-full" href="/garage">
        Abrir garagem <ArrowRight class="h-3.5 w-3.5" />
      </a>
    </article>
  </div>
</section>

<style>
  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 0 var(--accent-ring);
    animation: breathe 2.4s ease-out infinite;
  }

  @keyframes breathe {
    0% {
      box-shadow: 0 0 0 0 var(--accent-ring);
    }
    70%,
    100% {
      box-shadow: 0 0 0 7px transparent;
    }
  }

  .up {
    color: var(--success);
  }

  .down {
    color: var(--accent);
  }

  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    pointer-events: none;
    opacity: 0.14;
    background: repeating-linear-gradient(100deg, var(--accent) 0 6px, transparent 6px 16px);
  }

  .garage-row {
    transition: background 0.15s;
  }

  .garage-row:hover {
    background: color-mix(in srgb, var(--accent) 5%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .live-dot {
      animation: none;
    }
  }
</style>
