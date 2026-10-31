<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import TrendChart from "$components/charts/TrendChart.svelte";
  import CostDonut from "$components/charts/CostDonut.svelte";
  import ActivityHeatmap from "$components/charts/ActivityHeatmap.svelte";
  import SpendBars from "$components/charts/SpendBars.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import { Tire } from "$components/icons";
  import ActivityTimeline from "$lib/components/app/ActivityTimeline.svelte";
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import Fuel from "lucide-svelte/icons/fuel";
  import ReceiptText from "lucide-svelte/icons/receipt-text";
  import Wrench from "lucide-svelte/icons/wrench";
  import { t, format } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";

  type Insights = {
    consumption: Array<{ date: string; value: number }>;
    spend: Array<{ month: string; cents: number }>;
    costs: Array<{ key: string; cents: number }>;
    activity: Array<{ date: string; count: number }>;
    recentActivity: Array<{
      id: string;
      type: string;
      date: string;
      title: string;
      subtitle: string;
      amountCents: number;
      href: string;
    }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    benchmark: any;
  };

  /** The garage analysis that used to sit under the bike home. */
  export let insights: Insights;
  /** Failure message from the comparison form, shown next to it. */
  export let benchmarkMessage = "";

  let benchmarkBusy = false;

  const enhanceBenchmark: SubmitFunction = () => {
    benchmarkBusy = true;
    return async ({ update }) => {
      benchmarkBusy = false;
      // A failure is rendered through `benchmarkMessage` below.
      await update();
    };
  };

  const COST_KEY = {
    fuel: "dashboard.costFuel",
    maintenance: "dashboard.costMaintenance",
    tires: "dashboard.costTires",
    fees: "dashboard.costFees",
  } as const satisfies Record<string, MessageKey>;

  const benchmarkPositionKey = {
    "acima da média": "dashboard.benchmarkAbove",
    "abaixo da média": "dashboard.benchmarkBelow",
    "na média": "dashboard.benchmarkAverage",
    "sem comparação": "dashboard.benchmarkUnavailable",
  } as const satisfies Record<string, MessageKey>;

  const positionLabel = (position: string) =>
    $t(
      benchmarkPositionKey[position as keyof typeof benchmarkPositionKey] ??
        "dashboard.benchmarkUnavailable",
    );

  // costBreakdown() returns keys, not wording, so the labels are attached here.
  $: costSlices = (insights.costs ?? []).map((slice) => ({
    ...slice,
    label: $t(COST_KEY[slice.key as keyof typeof COST_KEY]),
  }));

  $: consumption = insights.consumption ?? [];
  $: hasSpend = (insights.spend ?? []).some((entry) => entry.cents > 0);
  $: hasActivity = (insights.activity ?? []).some((cell) => cell.count > 0);

  $: activityItems = (insights.recentActivity ?? []).map((item) => ({
    ...item,
    dateLabel: item.date
      ? $format.date(`${item.date}T00:00:00.000Z`, {
          day: "2-digit",
          month: "short",
          timeZone: "UTC",
        })
      : "",
  }));
</script>

<div class="grid gap-6">
  {#if consumption.length > 1}
    <section class="panel p-5 sm:p-6" aria-labelledby="consumption-title">
      <h2 id="consumption-title" class="display text-2xl">
        {$t("home.consumptionTitle")}
      </h2>
      <p class="mt-1 text-sm text-[var(--muted)]">
        {$t("dashboard.consumptionHint")}
      </p>
      <div class="mt-4">
        <TrendChart points={consumption} unit="km/L" />
      </div>
    </section>
  {/if}

  <section class="panel p-5 sm:p-6" aria-labelledby="costs-title">
    <h2 id="costs-title" class="display text-2xl">
      {$t("home.costsTitle")}
    </h2>
    <p class="mt-1 text-sm text-[var(--muted)]">
      {$t("dashboard.monthlySpendHint")}
    </p>
    {#if hasSpend || costSlices.length}
      <div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h3 class="label-tech text-[var(--muted)]">
            {$t("dashboard.monthlySpend")}
          </h3>
          <div class="mt-3">
            {#if hasSpend}
              <SpendBars months={insights.spend} />
            {:else}
              <p class="py-10 text-center text-sm text-[var(--muted)]">
                {$t("dashboard.monthlySpendEmpty")}
              </p>
            {/if}
          </div>
        </div>
        <div>
          <h3 class="label-tech text-[var(--muted)]">
            {$t("home.costSplit")} · {$t("dashboard.costsHint")}
          </h3>
          <div class="mt-3">
            {#if costSlices.length}
              <CostDonut slices={costSlices} />
            {:else}
              <p class="py-10 text-center text-sm text-[var(--muted)]">
                {$t("dashboard.costsEmpty")}
              </p>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <div class="mt-5">
        <EmptyState
          compact
          icon={ReceiptText}
          title={$t("home.noCostsTitle")}
          description={$t("dashboard.costsEmpty")}
        >
          {#snippet action()}
            <a class="button-secondary" href="/expenses?new=1"
              >{$t("home.addExpense")}</a
            >
          {/snippet}
        </EmptyState>
      </div>
    {/if}
  </section>

  <section class="panel p-5 sm:p-6" aria-labelledby="activity-title">
    <h2 id="activity-title" class="display text-2xl">
      {$t("home.activityTitle")}
    </h2>
    <div class="mt-4">
      <ActivityTimeline
        title=""
        emptyMessage={$t("authenticatedUx.emptyTimeline")}
        items={activityItems}
      >
        <svelte:fragment slot="item" let:item>
          {@const act = item}
          <a
            href={act.href}
            class="focus-ring flex items-center justify-between gap-3 rounded p-2 transition-colors hover:bg-[var(--panel-sunken)]"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--line)] bg-[var(--panel-sunken)] text-[var(--muted)]"
                aria-hidden="true"
              >
                {#if act.type === "fuel"}
                  <Fuel size={16} />
                {:else if act.type === "maintenance"}
                  <Wrench size={16} />
                {:else if act.type === "tires"}
                  <Tire size={16} />
                {:else}
                  <ReceiptText size={16} />
                {/if}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-[var(--fg)]">
                  {act.title}
                </p>
                <p class="text-xs text-[var(--muted)]">
                  {act.dateLabel}{act.subtitle ? ` · ${act.subtitle}` : ""}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              {#if act.amountCents > 0}
                <span class="numeric text-sm font-semibold">
                  {$format.money(act.amountCents)}
                </span>
              {/if}
              <ArrowRight size={16} class="text-[var(--muted)]" />
            </div>
          </a>
        </svelte:fragment>
      </ActivityTimeline>
    </div>

    {#if hasActivity}
      <details class="group/calendar mt-5 border-t border-[var(--line)] pt-2">
        <summary
          class="focus-ring flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded text-sm font-semibold"
        >
          <span>
            {$t("home.activityCalendar")}
            <span class="font-normal text-[var(--muted)]"
              >· {$t("dashboard.activityHint")}</span
            >
          </span>
          <ChevronDown
            size={20}
            class="shrink-0 text-[var(--muted)] transition-transform duration-200 group-open/calendar:rotate-180"
          />
        </summary>
        <div class="mt-4">
          <ActivityHeatmap cells={insights.activity} />
        </div>
      </details>
    {/if}
  </section>

  <!-- Opt-in community comparison, collapsed until asked for. -->
  <article id="benchmark" class="panel p-5 sm:p-6">
    <details class="group/benchmark">
      <summary
        class="focus-ring flex min-h-11 cursor-pointer items-start justify-between gap-4 rounded"
      >
        <span class="min-w-0">
          <span class="display block text-2xl">
            {$t("dashboard.benchmarkTitle")}
          </span>
          <span class="mt-1 block max-w-2xl text-sm text-[var(--muted)]">
            {$t("dashboard.benchmarkHint")}
          </span>
          {#if insights.benchmark?.modelLabel}
            <span class="mt-2 block text-sm font-semibold">
              {insights.benchmark.modelLabel}
            </span>
          {/if}
        </span>
        <ChevronDown
          size={20}
          class="mt-1 shrink-0 text-[var(--muted)] transition-transform duration-200 group-open/benchmark:rotate-180"
        />
      </summary>

      <p class="mt-4 max-w-2xl text-sm text-[var(--muted)]">
        {$t("dashboard.benchmarkPrivacy")}
      </p>

      {#if insights.benchmark?.modelLabel}
        <div class="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div class="rounded border border-[var(--line)] p-4">
            <p class="label-tech text-[var(--muted)]">
              {$t("dashboard.benchmarkYourData")}
            </p>
            <dl class="mt-3 grid gap-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt>{$t("dashboard.benchmarkConsumption")}</dt>
                <dd class="numeric font-semibold">
                  {#if insights.benchmark.local?.consumptionKmL !== null && insights.benchmark.local?.consumptionKmL !== undefined}
                    {$format.number(insights.benchmark.local.consumptionKmL, {
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
                  {#if insights.benchmark.local?.maintenanceCentsPer1000Km !== null && insights.benchmark.local?.maintenanceCentsPer1000Km !== undefined}
                    {$format.money(
                      insights.benchmark.local.maintenanceCentsPer1000Km,
                    )}
                  {:else}
                    {$t("dashboard.benchmarkUnavailable")}
                  {/if}
                </dd>
              </div>
            </dl>
            {#if insights.benchmark.local}
              <p class="mt-3 text-xs text-[var(--muted)]">
                {$t("dashboard.benchmarkIntervals", {
                  count: String(insights.benchmark.local.consumptionIntervals),
                })}
                ·
                {$t("dashboard.benchmarkMaintenanceRecords", {
                  count: String(insights.benchmark.local.maintenanceRecords),
                })}
                {#if insights.benchmark.local.distanceKm !== null}
                  · {$t("dashboard.benchmarkDistanceRecorded", {
                    distance: $format.distance(
                      insights.benchmark.local.distanceKm,
                    ),
                  })}
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
                  count: insights.benchmark.sampleSize,
                })}
              </span>
            </div>
            {#if insights.benchmark.sampleSize < insights.benchmark.minimumSampleSize}
              <p class="mt-4 text-sm text-[var(--muted)]">
                {$t("dashboard.benchmarkNeedMore", {
                  count:
                    insights.benchmark.minimumSampleSize -
                    insights.benchmark.sampleSize,
                })}
              </p>
            {/if}
            {#if insights.benchmark.cohort}
              <dl class="mt-3 grid gap-2 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <dt>{$t("dashboard.benchmarkConsumption")}</dt>
                  <dd class="text-right">
                    {#if insights.benchmark.cohort.consumption.average !== null}
                      <span class="numeric font-semibold"
                        >{$format.number(
                          insights.benchmark.cohort.consumption.average,
                          {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 2,
                          },
                        )} km/L</span
                      >
                      <span class="ml-1 text-xs text-[var(--muted)]"
                        >{positionLabel(
                          insights.benchmark.cohort.consumption.position,
                        )}</span
                      >
                    {:else}
                      <span class="text-xs text-[var(--muted)]">
                        {$t("dashboard.benchmarkMetricSample", {
                          count:
                            insights.benchmark.cohort.consumption.sampleSize,
                          minimum: insights.benchmark.minimumSampleSize,
                        })}
                      </span>
                    {/if}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt>{$t("dashboard.benchmarkMaintenance")}</dt>
                  <dd class="text-right">
                    {#if insights.benchmark.cohort.maintenance.average !== null}
                      <span class="numeric font-semibold"
                        >{$format.money(
                          insights.benchmark.cohort.maintenance.average,
                        )}</span
                      >
                      <span class="ml-1 text-xs text-[var(--muted)]"
                        >{positionLabel(
                          insights.benchmark.cohort.maintenance.position,
                        )}</span
                      >
                    {:else}
                      <span class="text-xs text-[var(--muted)]">
                        {$t("dashboard.benchmarkMetricSample", {
                          count:
                            insights.benchmark.cohort.maintenance.sampleSize,
                          minimum: insights.benchmark.minimumSampleSize,
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
          <div
            class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          >
            <div class="grid gap-1">
              <label class="field-label" for="benchmark-motorcycle"
                >{$t("dashboard.benchmarkModel")}</label
              >
              <select
                class="field"
                id="benchmark-motorcycle"
                name="motorcycle_id"
                required
                value={insights.benchmark.motorcycleId ?? ""}
              >
                {#each insights.benchmark.models as model (model.id)}
                  <option value={model.id}>{model.name} · {model.label}</option>
                {/each}
              </select>
            </div>
            <button
              class="button-primary min-h-11 shrink-0"
              type="submit"
              disabled={benchmarkBusy ||
                !insights.benchmark.hasComparableMetric}
            >
              {#if benchmarkBusy}
                <span class="inline-block animate-pulse"
                  >{$t("common.save")}…</span
                >
              {:else}
                {insights.benchmark.submitted
                  ? $t("dashboard.benchmarkUpdate")
                  : $t("dashboard.benchmarkShare")}
              {/if}
            </button>
          </div>
          <label
            class="flex cursor-pointer items-start gap-2.5 rounded p-1 text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
          >
            <input
              class="mt-1 accent-[var(--fg)]"
              type="checkbox"
              name="consent"
              value="on"
              required
            />
            <span>{$t("dashboard.benchmarkConsent")}</span>
          </label>
          {#if benchmarkMessage}
            <p
              class="text-sm text-[var(--danger)]"
              role="alert"
              aria-live="assertive"
            >
              {benchmarkMessage}
            </p>
          {/if}
          {#if insights.benchmark.submitted}
            <p
              class="text-xs text-[var(--muted)]"
              role="status"
              aria-live="polite"
            >
              {$t("dashboard.benchmarkActive")}
            </p>
          {/if}
        </form>
      {:else if insights.benchmark}
        <p
          class="mt-5 rounded border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]"
        >
          {$t("dashboard.benchmarkNoModel")}
        </p>
      {/if}
    </details>
  </article>
</div>
