<script lang="ts">
  import MetricCard from "$components/MetricCard.svelte";
  import HealthGauge from "$components/charts/HealthGauge.svelte";
  import TrendChart from "$components/charts/TrendChart.svelte";
  import CostDonut from "$components/charts/CostDonut.svelte";
  import ActivityHeatmap from "$components/charts/ActivityHeatmap.svelte";
  import SpendBars from "$components/charts/SpendBars.svelte";
  import { ArrowRight, Bell, Fuel, TriangleAlert } from "lucide-svelte";
  import { t, format } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";

  export let data;

  const STATUS_KEY = {
    overdue: "dashboard.statusOverdue",
    due_soon: "dashboard.statusDueSoon",
    ok: "dashboard.statusOk",
    unknown: "common.empty",
  } as const satisfies Record<string, MessageKey>;

  const HEALTH_KEY = {
    overdue: "dashboard.healthOverdue",
    attention: "dashboard.healthAttention",
    ready: "dashboard.healthReady",
  } as const satisfies Record<string, MessageKey>;

  const COST_KEY = {
    fuel: "dashboard.costFuel",
    maintenance: "dashboard.costMaintenance",
    tires: "dashboard.costTires",
    fees: "dashboard.costFees",
  } as const satisfies Record<string, MessageKey>;

  // costBreakdown() returns keys, not wording, so the labels are attached here.
  $: costSlices = (data.costs ?? []).map(
    (slice: { key: keyof typeof COST_KEY; cents: number }) => ({
      ...slice,
      label: $t(COST_KEY[slice.key]),
    }),
  );

  $: consumption = data.consumption ?? [];
  $: latestConsumption = consumption[consumption.length - 1]?.value ?? null;
  $: previousConsumption = consumption[consumption.length - 2]?.value ?? null;
  // Higher km/L is better, so an increase is a win worth calling out.
  $: consumptionDelta =
    latestConsumption !== null && previousConsumption
      ? Math.round(
          ((latestConsumption - previousConsumption) / previousConsumption) *
            1000,
        ) / 10
      : null;

  $: hasSpend = (data.spend ?? []).some((entry) => entry.cents > 0);
  $: hasActivity = (data.activity ?? []).some((cell) => cell.count > 0);
</script>

<svelte:head><title>{$t("nav.dashboard")} · Moto Track</title></svelte:head>

<section class="grid gap-6">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>
        {$t("nav.dashboard")}
      </p>
      <h1 class="display mt-3 text-5xl">{$t("nav.tagline")}</h1>
      <p class="live mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
        <span class="live-dot" aria-hidden="true"></span>
        {$t("dashboard.synced")} · {$format.date(
          `${data.today}T00:00:00.000Z`,
          {
            day: "2-digit",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          },
        )}
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
          <h2 class="display text-2xl">{$t("dashboard.consumption")}</h2>
          <p class="mt-1 text-sm text-[var(--muted)]">
            {$t("dashboard.consumptionHint")}
          </p>
        </div>
        {#if latestConsumption !== null}
          <div class="text-right">
            <p class="display numeric text-4xl text-[var(--accent)]">
              {$format.number(latestConsumption, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </p>
            <p class="label-tech text-[var(--muted)]">
              km/L
              {#if consumptionDelta !== null && consumptionDelta !== 0}
                <span
                  class:up={consumptionDelta > 0}
                  class:down={consumptionDelta < 0}
                >
                  {consumptionDelta > 0 ? "▲" : "▼"}
                  {$format.number(Math.abs(consumptionDelta), {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}%
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
        <div
          class="mt-6 flex flex-col items-center justify-center gap-3 py-14 text-center"
        >
          <Fuel class="h-6 w-6 text-[var(--accent)]" />
          <p class="label-tech text-[var(--accent)]">
            {$t("dashboard.consumptionEmpty")}
          </p>
          <p class="max-w-xs text-sm text-[var(--muted)]">
            {$t("dashboard.consumptionEmptyHint")}
          </p>
          <a class="button-secondary mt-1" href="/fuel"
            >{$t("dashboard.addFuel")}</a
          >
        </div>
      {/if}
    </article>

    <article class="panel relative overflow-hidden p-6">
      <div class="corner-slashes" aria-hidden="true"></div>
      <div class="relative">
        <h2 class="display text-2xl">{$t("dashboard.health")}</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">
          {#if data.healthMotorcycle}
            {$t("dashboard.healthWorst")} · {data.healthMotorcycle}
          {:else}
            {$t("dashboard.healthHint")}
          {/if}
        </p>

        {#if data.health}
          <div class="mt-5">
            <HealthGauge
              score={data.health.total}
              status={$t(HEALTH_KEY[data.health.status])}
            />
          </div>

          <ul class="mt-5 grid gap-2 border-t border-[var(--line)] pt-4">
            {#each data.upcoming as reminder (reminder.id)}
              <li class="flex items-center gap-3 text-sm">
                <span
                  class="tick"
                  class:tick--accent={reminder.status === "overdue"}
                  aria-hidden="true"
                ></span>
                <span class="flex-1 truncate">{reminder.title}</span>
                <span
                  class="label-tech shrink-0 text-[10px] {reminder.status ===
                  'overdue'
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--muted)]'}"
                >
                  {#if reminder.remainingKm !== null && reminder.status !== "ok"}
                    {reminder.remainingKm <= 0
                      ? $t(STATUS_KEY.overdue)
                      : $format.distance(reminder.remainingKm)}
                  {:else if reminder.remainingDays !== null && reminder.status !== "ok"}
                    {reminder.remainingDays <= 0
                      ? $t(STATUS_KEY.overdue)
                      : $t("dashboard.inDays", {
                          count: reminder.remainingDays,
                        })}
                  {:else}
                    {$t(STATUS_KEY[reminder.status])}
                  {/if}
                </span>
              </li>
            {:else}
              <li class="py-2 text-sm text-[var(--muted)]">
                {$t("dashboard.noReminders")}
              </li>
            {/each}
          </ul>
          <a class="button-secondary mt-4 w-full" href="/reminders">
            <Bell class="h-3.5 w-3.5" />
            {$t("dashboard.viewReminders")}
          </a>
        {:else}
          <div
            class="flex flex-col items-center justify-center gap-3 py-16 text-center"
          >
            <TriangleAlert class="h-6 w-6 text-[var(--accent)]" />
            <p class="label-tech text-[var(--accent)]">
              {$t("dashboard.emptyGarage")}
            </p>
            <p class="max-w-[15rem] text-sm text-[var(--muted)]">
              {$t("dashboard.emptyGarageHint")}
            </p>
            <a class="button-primary mt-1" href="/garage"
              >{$t("dashboard.addBike")}</a
            >
          </div>
        {/if}
      </div>
    </article>
  </div>

  <!-- Activity + costs -->
  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <article class="panel p-6">
      <h2 class="display text-2xl">{$t("dashboard.activity")}</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">
        {$t("dashboard.activityHint")}
      </p>
      <div class="mt-5">
        {#if hasActivity}
          <ActivityHeatmap cells={data.activity} />
        {:else}
          <p class="py-10 text-center text-sm text-[var(--muted)]">
            {$t("dashboard.activityEmpty")}
          </p>
        {/if}
      </div>
    </article>

    <article class="panel p-6">
      <h2 class="display text-2xl">{$t("dashboard.costs")}</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">
        {$t("dashboard.costsHint")}
      </p>
      <div class="mt-6">
        {#if costSlices.length}
          <CostDonut slices={costSlices} />
        {:else}
          <p class="py-10 text-center text-sm text-[var(--muted)]">
            {$t("dashboard.costsEmpty")}
          </p>
        {/if}
      </div>
    </article>
  </div>

  <!-- Spend + garage -->
  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <article class="panel p-6">
      <h2 class="display text-2xl">{$t("dashboard.monthlySpend")}</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">
        {$t("dashboard.monthlySpendHint")}
      </p>
      <div class="mt-5">
        {#if hasSpend}
          <SpendBars months={data.spend} />
        {:else}
          <p class="py-10 text-center text-sm text-[var(--muted)]">
            {$t("dashboard.monthlySpendEmpty")}
          </p>
        {/if}
      </div>
    </article>

    <article class="panel p-6">
      <h2 class="display text-2xl">{$t("nav.garage")}</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">
        {$t("dashboard.garageHint")}
      </p>
      <ul class="mt-5 grid gap-1">
        {#each data.garage as motorcycle, i (motorcycle.id)}
          <li class="garage-row flex items-center gap-3 rounded px-2 py-2.5">
            <span
              class="label-tech numeric w-6 shrink-0 text-center text-[var(--muted)]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold"
                >{motorcycle.name}</span
              >
              <span class="block truncate text-xs text-[var(--muted)]"
                >{motorcycle.detail}</span
              >
            </span>
            <span class="shrink-0 text-right">
              <span class="numeric block text-sm font-semibold">
                {$format.distance(motorcycle.odometer)}
              </span>
              <span
                class="label-tech block text-[10px] {motorcycle.health.total <
                50
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--muted)]'}"
              >
                {$t("dashboard.healthScore", {
                  score: motorcycle.health.total,
                })}
              </span>
            </span>
          </li>
        {:else}
          <li class="py-8 text-center text-sm text-[var(--muted)]">
            {$t("dashboard.noActiveBike")}
          </li>
        {/each}
      </ul>
      <a class="button-secondary mt-4 w-full" href="/garage">
        {$t("dashboard.openGarage")}
        <ArrowRight class="h-3.5 w-3.5" />
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
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
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
