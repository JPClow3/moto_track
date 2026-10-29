<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import type { SubmitFunction } from "@sveltejs/kit";
  import type { PageData } from "./$types";
  import MetricCard from "$components/MetricCard.svelte";
  import HealthGauge from "$components/charts/HealthGauge.svelte";
  import TrendChart from "$components/charts/TrendChart.svelte";
  import CostDonut from "$components/charts/CostDonut.svelte";
  import ActivityHeatmap from "$components/charts/ActivityHeatmap.svelte";
  import SpendBars from "$components/charts/SpendBars.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { Motorcycle, Odometer, Tire } from "$components/icons";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import ActivityTimeline from "$lib/components/app/ActivityTimeline.svelte";
  import ActionMenu, {
    type ActionChoice,
  } from "$lib/components/app/ActionMenu.svelte";
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import CircleCheck from "lucide-svelte/icons/circle-check";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import Fuel from "lucide-svelte/icons/fuel";
  import ReceiptText from "lucide-svelte/icons/receipt-text";
  import Wrench from "lucide-svelte/icons/wrench";
  import { t, format } from "$lib/i18n/store";
  import type { MessageKey, Translator } from "$lib/i18n";

  export let data;
  export let form;

  type AttentionEntry = NonNullable<PageData["nextDue"]>;
  type HealthTone = "ok" | "due" | "overdue";

  let benchmarkBusy = false;
  let actionMenu: ActionMenu;

  const enhanceBenchmark: SubmitFunction = () => {
    benchmarkBusy = true;
    return async ({ update }) => {
      benchmarkBusy = false;
      // A failure is rendered through `form` below.
      await update();
    };
  };

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

  const benchmarkPositionKey = {
    "acima da média": "dashboard.benchmarkAbove",
    "abaixo da média": "dashboard.benchmarkBelow",
    "na média": "dashboard.benchmarkAverage",
    "sem comparação": "dashboard.benchmarkUnavailable",
  } as const satisfies Record<string, MessageKey>;

  // Same thresholds as HealthGauge: green from 80, amber from 50, red below.
  const healthTone = (score: number): HealthTone =>
    score >= 80 ? "ok" : score >= 50 ? "due" : "overdue";
  const TONE_COLOR: Record<HealthTone, string> = {
    ok: "var(--success)",
    due: "var(--warning)",
    overdue: "var(--accent)",
  };

  $: garage = data.garage ?? [];
  // Older payloads (and the unit contract) only carry the garage list, so the
  // hero falls back to the first active bike.
  $: hero = data.hero ?? garage[0] ?? null;
  $: headline = data.headline ?? null;
  $: costPerKm = headline?.costPerKm ?? null;
  $: averageConsumption = headline?.averageConsumptionKmL ?? null;

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
  $: consumptionDelta =
    latestConsumption !== null && previousConsumption
      ? Math.round(
          ((latestConsumption - previousConsumption) / previousConsumption) *
            1000,
        ) / 10
      : null;
  $: hasConsumption = averageConsumption !== null || consumption.length > 0;
  $: shownConsumption = averageConsumption ?? latestConsumption;

  $: hasSpend = (data.spend ?? []).some((entry) => entry.cents > 0);
  $: hasActivity = (data.activity ?? []).some((cell) => cell.count > 0);

  const oneDecimal = { minimumFractionDigits: 1, maximumFractionDigits: 1 };

  // Plain helpers that take the translator explicitly; the reactive
  // statements below pass $t / $format so a locale switch re-renders them.
  function dueDetail(
    item: AttentionEntry,
    tr: Translator,
    distance: (km: number) => string,
  ) {
    if (item.kind === "maintenance") {
      return item.dueKm !== null
        ? tr("home.milestoneAt", { distance: distance(item.dueKm) })
        : "";
    }
    if (item.remainingKm !== null) {
      return item.remainingKm < 0
        ? tr("home.passedKm", {
            distance: distance(Math.abs(item.remainingKm)),
          })
        : tr("home.remainingKm", { distance: distance(item.remainingKm) });
    }
    if (item.remainingDays !== null) {
      const days = item.remainingDays;
      if (days === 0) return tr("home.dueToday");
      if (days < 0) {
        return days === -1
          ? tr("home.overdueDaysOne")
          : tr("home.overdueDaysOther", { count: Math.abs(days) });
      }
      return days === 1
        ? tr("home.inDaysOne")
        : tr("home.inDaysOther", { count: days });
    }
    return "";
  }

  function describeAttention(
    item: AttentionEntry,
    withBike: boolean,
    tr: Translator,
    distance: (km: number) => string,
  ) {
    return {
      ...item,
      meta: [
        item.kind === "maintenance"
          ? tr("home.kindMaintenance")
          : tr("home.kindReminder"),
        withBike ? item.motorcycleName || tr("home.general") : "",
        dueDetail(item, tr, distance),
      ]
        .filter(Boolean)
        .join(" · "),
      statusLabel:
        item.tone === "overdue"
          ? tr("dashboard.statusOverdue")
          : tr("dashboard.statusDueSoon"),
      confidenceLabel:
        item.confidence === "confirmed"
          ? tr("dashboard.confidenceConfirmed")
          : item.confidence === "reported_not_done"
            ? tr("dashboard.confidenceNotDone")
            : tr("dashboard.confidenceUnknown"),
    };
  }

  $: nextDue = data.nextDue
    ? describeAttention(data.nextDue, false, $t, $format.distance)
    : null;
  $: attention = (data.attention ?? []).map((item) =>
    describeAttention(item, garage.length > 1, $t, $format.distance),
  );

  $: actionChoices = [
    {
      id: "fuel",
      label: $t("authenticatedUx.fuelShortcut"),
      description: $t("authenticatedUx.fuelShortcutDesc"),
      recommended: true,
    },
    {
      id: "maintenance",
      label: $t("authenticatedUx.maintenanceShortcut"),
      description: $t("authenticatedUx.maintenanceShortcutDesc"),
    },
    {
      id: "expenses",
      label: $t("authenticatedUx.expenseShortcut"),
      description: $t("authenticatedUx.expenseShortcutDesc"),
    },
    {
      id: "documents",
      label: $t("authenticatedUx.documentShortcut"),
      description: $t("authenticatedUx.documentShortcutDesc"),
    },
  ] satisfies ActionChoice[];

  const ACTION_ROUTES: Record<string, string> = {
    fuel: "/fuel?new=1",
    maintenance: "/maintenance?new=1",
    expenses: "/expenses?new=1",
    documents: "/documents?new=1",
  };

  function handleActionSelect(event: CustomEvent<string>) {
    const route = ACTION_ROUTES[event.detail];
    if (route) goto(route);
  }

  type ActivityItem = {
    id: string;
    type: string;
    date: string;
    title: string;
    subtitle: string;
    amountCents: number;
    href: string;
  };

  $: activityItems = ((data.recentActivity ?? []) as ActivityItem[]).map(
    (item) => ({
      ...item,
      dateLabel: item.date
        ? $format.date(`${item.date}T00:00:00.000Z`, {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          })
        : "",
    }),
  );
</script>

<svelte:head><title>{$t("home.title")} · Moto Track</title></svelte:head>

<section class="grid gap-6">
  <PageHeader title={$t("home.title")}>
    <svelte:fragment slot="actions">
      <PageAction
        label={$t("authenticatedUx.addRecord")}
        ariaLabel={$t("authenticatedUx.addRecord")}
        on:click={() => actionMenu?.open()}
      />
    </svelte:fragment>
  </PageHeader>

  <ActionMenu
    bind:this={actionMenu}
    title={$t("authenticatedUx.addRecord")}
    choices={actionChoices}
    on:select={handleActionSelect}
  />

  {#if data.errorMessage}
    <div
      class="flex flex-col gap-3 rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="alert"
      aria-live="assertive"
    >
      <span class="text-[var(--danger)]">{data.errorMessage}</span>
      <a class="button-secondary min-h-11 shrink-0" href="/dashboard"
        >{$t("common.retry")}</a
      >
    </div>
  {/if}

  {#if !hero}
    <EmptyState
      icon={Motorcycle}
      title={$t("home.addBikeTitle")}
      description={$t("home.addBikeHint")}
    >
      {#snippet action()}
        <a class="button-primary" href="/garage">{$t("home.addBike")}</a>
      {/snippet}
    </EmptyState>
  {:else}
    <!-- 1. The bike: who it is, how far it has gone, how healthy it is. -->
    <article
      class="bike-hero panel overflow-hidden"
      aria-labelledby="hero-name"
    >
      <div class="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div
          class="relative h-40 bg-[var(--panel-invert)] sm:h-52 md:h-auto md:min-h-60"
        >
          {#if hero.photoUrl}
            <img
              src={hero.photoUrl}
              alt={$t("home.photoAlt", { name: hero.name })}
              class="absolute inset-0 h-full w-full object-cover"
            />
          {:else}
            <div
              class="absolute inset-0 grid place-items-center"
              aria-hidden="true"
            >
              <span
                class="grid h-14 w-14 place-items-center rounded-full border border-white/15 text-white/70"
              >
                <Motorcycle size={24} />
              </span>
            </div>
          {/if}
        </div>

        <div class="flex flex-col gap-5 p-5 sm:p-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              {#if hero.modelLabel}
                <p class="text-sm text-[var(--muted)]">{hero.modelLabel}</p>
              {/if}
              <h2 id="hero-name" class="display mt-1 break-words text-4xl">
                {hero.name}
              </h2>
              <p
                class="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]"
              >
                <Odometer size={16} />
                <span>{$t("home.odometer")}</span>
                <span class="numeric text-base font-semibold text-[var(--fg)]">
                  {$format.distance(hero.odometer)}
                </span>
              </p>
            </div>
            <div class="shrink-0">
              <p class="label-tech text-center text-[var(--muted)]">
                {$t("home.health")}
              </p>
              <HealthGauge
                compact
                score={hero.health.total}
                status={$t(HEALTH_KEY[hero.health.status])}
              />
            </div>
          </div>

          {#if garage.length > 1}
            <!-- Same ?bike= switch the shell uses: the layout stores the choice
                 and redirects back here. The dots carry each bike's health. -->
            <nav
              class="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4"
              aria-label={$t("home.bikeSwitcher")}
            >
              {#each garage as bike (bike.id)}
                {@const current = bike.id === hero.id}
                <a
                  href={`/dashboard?bike=${encodeURIComponent(bike.id)}`}
                  aria-current={current ? "page" : undefined}
                  class="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors {current
                    ? 'border-[var(--fg)] text-[var(--fg)]'
                    : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--fg-soft)] hover:text-[var(--fg)]'}"
                >
                  <span
                    class="h-2 w-2 shrink-0 rounded-full"
                    style={`background:${TONE_COLOR[healthTone(bike.health.total)]}`}
                    aria-hidden="true"
                  ></span>
                  {bike.name}
                  <span class="sr-only">
                    · {$t("dashboard.healthScore", {
                      score: bike.health.total,
                    })}
                  </span>
                </a>
              {/each}
            </nav>
          {:else}
            <a
              class="focus-ring self-start rounded text-sm font-semibold text-[var(--fg)] underline underline-offset-4"
              href="/garage">{$t("dashboard.openGarage")}</a
            >
          {/if}
        </div>
      </div>
    </article>

    <!-- 2. The one thing that needs the rider, or a calm all-clear. -->
    {#if nextDue}
      <article
        class="panel border-l-4 p-5 sm:p-6 {nextDue.tone === 'overdue'
          ? 'border-l-[var(--accent)]'
          : 'border-l-[var(--warning)]'}"
        aria-labelledby="next-due-title"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="label-tech text-[var(--muted)]">{$t("home.nextUp")}</p>
          <StatusBadge tone={nextDue.tone === "overdue" ? "overdue" : "due"}>
            {nextDue.statusLabel}
          </StatusBadge>
        </div>
        <a
          id="next-due-title"
          href={nextDue.href}
          class="focus-ring group mt-2 flex items-center justify-between gap-3 rounded"
        >
          <span class="min-w-0">
            <span class="display block break-words text-2xl">
              {nextDue.title}
            </span>
            <span class="mt-1 block text-sm text-[var(--muted)]">
              {nextDue.meta}
            </span>
          </span>
          <ChevronRight
            size={20}
            class="shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--fg)]"
          />
        </a>
        {#if nextDue.kind === "maintenance"}
          <p class="mt-3 text-sm text-[var(--muted)]">
            {#if nextDue.estimatedCostCents > 0}
              {$t("dashboard.estimate")}:
              <strong class="numeric text-[var(--fg)]"
                >{$format.money(nextDue.estimatedCostCents)}</strong
              >
              ·
            {/if}
            {nextDue.confidenceLabel}
          </p>
          {#if nextDue.officialUrl}
            <a
              class="mt-2 inline-block text-sm font-semibold text-[var(--fg)] underline underline-offset-4"
              href={nextDue.officialUrl}
              target="_blank"
              rel="noreferrer"
              >{$t("dashboard.officialManual")}: {nextDue.documentVersion} · {nextDue.pageReference}
              ↗</a
            >
          {/if}
        {/if}
      </article>
    {:else}
      <article
        class="panel flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"
            aria-hidden="true"
          >
            <CircleCheck size={20} />
          </span>
          <div class="min-w-0">
            <p class="font-semibold">{$t("home.allClear")}</p>
            <p class="text-sm text-[var(--muted)]">{$t("home.allClearHint")}</p>
          </div>
        </div>
        <a
          class="focus-ring rounded text-sm font-semibold text-[var(--fg)] underline underline-offset-4"
          href="/reminders">{$t("dashboard.viewReminders")}</a
        >
      </article>
    {/if}

    {#if attention.length}
      <section class="panel p-5 sm:p-6" aria-labelledby="attention-title">
        <h2 id="attention-title" class="label-tech text-[var(--muted)]">
          {$t("home.alsoAttention")}
        </h2>
        <ul class="mt-2 divide-y divide-[var(--line)]">
          {#each attention as item (`${item.kind}-${item.id}`)}
            <li>
              <a
                href={item.href}
                class="focus-ring flex min-h-11 items-center justify-between gap-3 rounded py-3"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold">
                    {item.title}
                  </span>
                  <span class="block text-xs text-[var(--muted)]">
                    {item.meta}
                  </span>
                </span>
                <StatusBadge tone={item.tone === "overdue" ? "overdue" : "due"}>
                  {item.statusLabel}
                </StatusBadge>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- 3. One tap to log what just happened. -->
    <nav
      class="grid grid-cols-3 gap-2 sm:gap-3"
      aria-label={$t("home.quickLog")}
    >
      <a
        class="button-secondary min-h-14 flex-col gap-1 px-2 sm:flex-row sm:gap-2"
        href="/fuel?new=1"
      >
        <Fuel size={20} aria-hidden="true" />
        <span>{$t("home.logFuel")}</span>
      </a>
      <a
        class="button-secondary min-h-14 flex-col gap-1 px-2 sm:flex-row sm:gap-2"
        href="/maintenance?new=1"
      >
        <Wrench size={20} aria-hidden="true" />
        <span>{$t("home.logService")}</span>
      </a>
      <a
        class="button-secondary min-h-14 flex-col gap-1 px-2 sm:flex-row sm:gap-2"
        href="/expenses?new=1"
      >
        <ReceiptText size={20} aria-hidden="true" />
        <span>{$t("home.logExpense")}</span>
      </a>
    </nav>

    <!-- 4. Two headline numbers: what riding costs and how it is consuming. -->
    <div class="grid gap-4 sm:grid-cols-2">
      <MetricCard
        href="/reports"
        label={$t("home.costPerKm")}
        value={costPerKm
          ? $format.money(costPerKm.centsPerKm)
          : $t("dashboard.noData")}
        detail={costPerKm
          ? $t("home.costPerKmDetail", {
              days: headline?.windowDays ?? 30,
              distance: $format.distance(costPerKm.distanceKm),
            })
          : $t("home.costPerKmEmpty")}
      />
      {#if hasConsumption && shownConsumption !== null}
        <MetricCard
          href="/fuel"
          label={$t("home.avgConsumption")}
          value={`${$format.number(shownConsumption, oneDecimal)} km/L`}
          detail={latestConsumption !== null
            ? $t("home.lastTank", {
                value: $format.number(latestConsumption, oneDecimal),
              })
            : $t("home.avgConsumptionDetail")}
        >
          {#if consumptionDelta !== null && consumptionDelta !== 0}
            <p
              class="mt-1 text-xs font-semibold {consumptionDelta > 0
                ? 'text-[var(--success)]'
                : 'text-[var(--warning)]'}"
            >
              {consumptionDelta > 0
                ? $t("home.deltaUp", {
                    value: $format.number(consumptionDelta, oneDecimal),
                  })
                : $t("home.deltaDown", {
                    value: $format.number(
                      Math.abs(consumptionDelta),
                      oneDecimal,
                    ),
                  })}
            </p>
          {/if}
        </MetricCard>
      {:else}
        <EmptyState
          compact
          icon={Fuel}
          title={$t("home.noFuelTitle")}
          description={$t("home.noFuelHint")}
        >
          {#snippet action()}
            <a class="button-primary" href="/fuel?new=1">{$t("home.addFuel")}</a
            >
          {/snippet}
        </EmptyState>
      {/if}
    </div>

    <!-- 5. Detail, from the bike's consumption to the garage's spending. -->
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
                <SpendBars months={data.spend} />
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
            <ActivityHeatmap cells={data.activity} />
          </div>
        </details>
      {/if}
    </section>

    <!-- 6. Opt-in community comparison, collapsed until asked for. -->
    <article class="panel p-5 sm:p-6">
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
            {#if data.benchmark?.modelLabel}
              <span class="mt-2 block text-sm font-semibold">
                {data.benchmark.modelLabel}
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
                  {$t("dashboard.benchmarkIntervals", {
                    count: String(data.benchmark.local.consumptionIntervals),
                  })}
                  ·
                  {$t("dashboard.benchmarkMaintenanceRecords", {
                    count: String(data.benchmark.local.maintenanceRecords),
                  })}
                  {#if data.benchmark.local.distanceKm !== null}
                    · {$t("dashboard.benchmarkDistanceRecorded", {
                      distance: $format.distance(
                        data.benchmark.local.distanceKm,
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
                    count: data.benchmark.sampleSize,
                  })}
                </span>
              </div>
              {#if data.benchmark.sampleSize < data.benchmark.minimumSampleSize}
                <p class="mt-4 text-sm text-[var(--muted)]">
                  {$t("dashboard.benchmarkNeedMore", {
                    count:
                      data.benchmark.minimumSampleSize -
                      data.benchmark.sampleSize,
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
                  value={data.benchmark.motorcycleId ?? ""}
                >
                  {#each data.benchmark.models as model (model.id)}
                    <option value={model.id}
                      >{model.name} · {model.label}</option
                    >
                  {/each}
                </select>
              </div>
              <button
                class="button-primary min-h-11 shrink-0"
                type="submit"
                disabled={benchmarkBusy || !data.benchmark.hasComparableMetric}
              >
                {#if benchmarkBusy}
                  <span class="inline-block animate-pulse"
                    >{$t("common.save")}…</span
                  >
                {:else}
                  {data.benchmark.submitted
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
            {#if form?.message}
              <p
                class="text-sm text-[var(--danger)]"
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
      </details>
    </article>
  {/if}
</section>
