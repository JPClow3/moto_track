<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
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
  export let form;

  let benchmarkBusy = false;
  const enhanceBenchmark: SubmitFunction = () => {
    benchmarkBusy = true;
    return async ({ result, update }) => {
      benchmarkBusy = false;
      await update();
      if (result.type === "failure") {
        // The action result is rendered through `form` below; keeping the
        // request state local prevents unrelated dashboard forms from being
        // disabled by this opt-in operation.
      }
    };
  };

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

  const benchmarkPositionKey = {
    "acima da média": "dashboard.benchmarkAbove",
    "abaixo da média": "dashboard.benchmarkBelow",
    "na média": "dashboard.benchmarkAverage",
    "sem comparação": "dashboard.benchmarkUnavailable",
  } as const satisfies Record<string, MessageKey>;
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

  {#if data.errorMessage}
    <div
      class="border-[var(--accent)]/30 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="alert"
      aria-live="assertive"
    >
      <span class="text-[var(--accent)]">{data.errorMessage}</span>
      <a class="button-secondary min-h-11 shrink-0" href="/dashboard"
        >{$t("common.retry")}</a
      >
    </div>
  {/if}

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.metrics as metric (metric.label)}
      <MetricCard {...metric} />
    {/each}
  </div>

  <article class="panel p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="eyebrow">
          <span class="slash-rule" aria-hidden="true"></span>{$t(
            "nav.maintenance",
          )}
        </p>
        <h2 class="display mt-2 text-2xl">{$t("dashboard.dueNowTitle")}</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">
          {$t("dashboard.dueNowHint")}
        </p>
      </div>
      <a class="button-secondary min-h-11 shrink-0" href="/maintenance"
        >{$t("dashboard.openMaintenance")}</a
      >
    </div>
    <div class="mt-5 grid gap-3 lg:grid-cols-2">
      {#each data.dueNow as item (item.id)}
        <article class="rounded border border-[var(--line)] p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="break-words font-semibold">{item.maintenanceType}</p>
              <p class="text-sm text-[var(--muted)]">{item.motorcycleName}</p>
            </div>
            <span
              class="label-tech shrink-0 rounded px-2 py-1 text-xs {item.urgency ===
              'overdue'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--warning)]'}"
              style={item.urgency === "overdue"
                ? undefined
                : "background: color-mix(in srgb, var(--warning) 10%, transparent)"}
            >
              {item.urgency === "overdue"
                ? $t("dashboard.urgencyOverdue")
                : $t("dashboard.urgencyNow")}
            </span>
          </div>
          <p class="mt-3 text-sm">
            {$t("dashboard.estimate")}:
            <strong>{$format.money(item.estimatedCostCents)}</strong>
            {#if item.dueKm !== null}
              · {$t("dashboard.milestone")}: {$format.distance(item.dueKm)}{/if}
          </p>
          <p class="mt-1 text-xs text-[var(--muted)]">
            {item.confidence === "confirmed"
              ? $t("dashboard.confidenceConfirmed")
              : item.confidence === "reported_not_done"
                ? $t("dashboard.confidenceNotDone")
                : $t("dashboard.confidenceUnknown")}
          </p>
          {#if item.officialUrl}
            <a
              class="mt-3 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline"
              href={item.officialUrl}
              target="_blank"
              rel="noreferrer"
              >{$t("dashboard.officialManual")}: {item.documentVersion} · {item.pageReference}
              ↗</a
            >
          {:else}
            <p class="mt-3 text-xs text-[var(--muted)]">
              {$t("dashboard.noManualSource")}
              <a
                class="font-semibold text-brand underline-offset-4 hover:underline"
                href="/garage">{$t("dashboard.openGarage")}</a
              >
            </p>
          {/if}
        </article>
      {:else}
        <p
          class="rounded border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]"
        >
          {$t("dashboard.dueNowEmpty")}
        </p>
      {/each}
    </div>
  </article>

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

  <article class="panel p-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="eyebrow">
          <span class="slash-rule" aria-hidden="true"></span>{$t(
            "dashboard.benchmarkTitle",
          )}
        </p>
        <h2 class="display mt-2 text-2xl">{$t("dashboard.benchmarkTitle")}</h2>
        <p class="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          {$t("dashboard.benchmarkHint")}
          {$t("dashboard.benchmarkPrivacy")}
        </p>
      </div>
      {#if data.benchmark?.modelLabel}
        <span class="label-tech rounded border border-[var(--line)] px-2 py-1">
          {data.benchmark.modelLabel}
        </span>
      {/if}
    </div>

    {#if data.benchmark?.modelLabel}
      <div class="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div class="rounded border border-[var(--line)] p-4">
          <p class="label-tech text-[var(--muted)]">
            {$t("dashboard.benchmarkYourData")}
          </p>
          <dl class="mt-3 grid gap-2 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt>{$t("dashboard.benchmarkConsumption")}</dt>
              <dd class="numeric font-semibold">
                {#if data.benchmark.local?.consumptionKmL !== null && data.benchmark.local?.consumptionKmL !== undefined}
                  {$format.number(data.benchmark.local.consumptionKmL, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2,
                  })}
                  km/L
                {:else}
                  {$t("dashboard.benchmarkUnavailable")}
                {/if}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt>{$t("dashboard.benchmarkMaintenance")}</dt>
              <dd class="numeric text-right font-semibold">
                {#if data.benchmark.local?.maintenanceCentsPer1000Km !== null && data.benchmark.local?.maintenanceCentsPer1000Km !== undefined}
                  {$format.money(
                    data.benchmark.local.maintenanceCentsPer1000Km,
                  )}
                {:else}
                  {$t("dashboard.benchmarkUnavailable")}
                {/if}
              </dd>
            </div>
          </dl>
          {#if data.benchmark.local}
            <p class="mt-3 text-xs text-[var(--muted)]">
              {data.benchmark.local.consumptionIntervals} intervalos de consumo ·
              {data.benchmark.local.maintenanceRecords} registros de manutenção
              {#if data.benchmark.local.distanceKm !== null}
                · {$format.distance(data.benchmark.local.distanceKm)} registrados
              {/if}
            </p>
          {/if}
        </div>

        <div class="rounded border border-[var(--line)] p-4">
          <div class="flex items-center justify-between gap-3">
            <p class="label-tech text-[var(--muted)]">
              {$t("dashboard.benchmarkCohort")}
            </p>
            <span class="label-tech text-[var(--muted)]">
              {$t("dashboard.benchmarkSample", {
                count: data.benchmark.sampleSize,
              })}
            </span>
          </div>
          {#if data.benchmark.sampleSize < data.benchmark.minimumSampleSize}
            <p class="mt-4 text-sm text-[var(--muted)]">
              {$t("dashboard.benchmarkNeedMore", {
                count:
                  data.benchmark.minimumSampleSize - data.benchmark.sampleSize,
              })}
            </p>
          {/if}
          {#if data.benchmark.cohort}
            <dl class="mt-3 grid gap-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt>{$t("dashboard.benchmarkConsumption")}</dt>
                <dd class="text-right">
                  {#if data.benchmark.cohort.consumption.average !== null}
                    <span class="numeric font-semibold"
                      >{$format.number(
                        data.benchmark.cohort.consumption.average,
                        {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        },
                      )} km/L</span
                    >
                    <span class="ml-1 text-xs text-[var(--muted)]"
                      >{$t(
                        benchmarkPositionKey[
                          data.benchmark.cohort.consumption.position
                        ],
                      )}</span
                    >
                  {:else}
                    <span class="text-xs text-[var(--muted)]">
                      {$t("dashboard.benchmarkMetricSample", {
                        count: data.benchmark.cohort.consumption.sampleSize,
                        minimum: data.benchmark.minimumSampleSize,
                      })}
                    </span>
                  {/if}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt>{$t("dashboard.benchmarkMaintenance")}</dt>
                <dd class="text-right">
                  {#if data.benchmark.cohort.maintenance.average !== null}
                    <span class="numeric font-semibold"
                      >{$format.money(
                        data.benchmark.cohort.maintenance.average,
                      )}</span
                    >
                    <span class="ml-1 text-xs text-[var(--muted)]"
                      >{$t(
                        benchmarkPositionKey[
                          data.benchmark.cohort.maintenance.position
                        ],
                      )}</span
                    >
                  {:else}
                    <span class="text-xs text-[var(--muted)]">
                      {$t("dashboard.benchmarkMetricSample", {
                        count: data.benchmark.cohort.maintenance.sampleSize,
                        minimum: data.benchmark.minimumSampleSize,
                      })}
                    </span>
                  {/if}
                </dd>
              </div>
            </dl>
          {:else}
            <p class="mt-4 text-sm text-[var(--muted)]">
              {$t("dashboard.benchmarkUnavailable")}
            </p>
          {/if}
        </div>
      </div>

      <form
        class="mt-5 grid gap-3 rounded border border-dashed border-[var(--line)] p-4"
        method="POST"
        action="?/contributeBenchmark"
        use:enhance={enhanceBenchmark}
      >
        <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div class="grid gap-1">
            <label class="field-label" for="benchmark-motorcycle"
              >{$t("dashboard.benchmarkModel")}</label
            >
            <select
              class="field"
              id="benchmark-motorcycle"
              name="motorcycle_id"
              required
              value={data.benchmark.motorcycleId ?? ""}
            >
              {#each data.benchmark.models as model (model.id)}
                <option value={model.id}>{model.name} · {model.label}</option>
              {/each}
            </select>
          </div>
          <button
            class="button-primary min-h-11"
            type="submit"
            disabled={benchmarkBusy || !data.benchmark.hasComparableMetric}
          >
            {data.benchmark.submitted
              ? $t("dashboard.benchmarkUpdate")
              : $t("dashboard.benchmarkShare")}
          </button>
        </div>
        <label class="flex items-start gap-2 text-sm text-[var(--muted)]">
          <input
            class="mt-1"
            type="checkbox"
            name="consent"
            value="on"
            required
          />
          <span>{$t("dashboard.benchmarkConsent")}</span>
        </label>
        {#if form?.message}
          <p
            class="text-sm text-[var(--accent)]"
            role="alert"
            aria-live="assertive"
          >
            {form.message}
          </p>
        {/if}
        {#if data.benchmark.submitted}
          <p
            class="text-xs text-[var(--muted)]"
            role="status"
            aria-live="polite"
          >
            {$t("dashboard.benchmarkActive")}
          </p>
        {/if}
      </form>
    {:else if data.benchmark}
      <p
        class="mt-5 rounded border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]"
      >
        {$t("dashboard.benchmarkNoModel")}
      </p>
    {/if}
  </article>

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
