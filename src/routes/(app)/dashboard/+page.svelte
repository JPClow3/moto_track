<script lang="ts">
  import type { PageData } from "./$types";
  import MetricCard from "$components/MetricCard.svelte";
  import HealthGauge from "$components/charts/HealthGauge.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge, {
    type StatusTone,
  } from "$components/ui/StatusBadge.svelte";
  import { Motorcycle, Odometer } from "$components/icons";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import ChartNoAxesCombined from "lucide-svelte/icons/chart-no-axes-combined";
  import CircleCheck from "lucide-svelte/icons/circle-check";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import { t, format } from "$lib/i18n/store";
  import type { MessageKey, Translator } from "$lib/i18n";

  export let data;

  type AttentionEntry = NonNullable<PageData["nextDue"]>;

  const HEALTH_KEY = {
    overdue: "dashboard.healthOverdue",
    attention: "dashboard.healthAttention",
    ready: "dashboard.healthReady",
  } as const satisfies Record<string, MessageKey>;

  // Red only for overdue, amber for due; an item whose history the rider
  // could not confirm is neutral — it asks a question, it is not a warning.
  const TONE: Record<
    AttentionEntry["tone"],
    { badge: StatusTone; label: MessageKey; border: string }
  > = {
    overdue: {
      badge: "overdue",
      label: "dashboard.statusOverdue",
      border: "border-l-[var(--accent)]",
    },
    due: {
      badge: "due",
      label: "dashboard.statusDueSoon",
      border: "border-l-[var(--warning)]",
    },
    confirm: {
      badge: "neutral",
      label: "dashboard.statusConfirm",
      border: "border-l-[var(--line)]",
    },
  };

  $: garage = data.garage ?? [];
  // Older payloads (and the unit contract) only carry the garage list, so the
  // hero falls back to the first active bike.
  $: hero = data.hero ?? garage[0] ?? null;
  $: headline = data.headline ?? null;
  $: costPerKm = headline?.costPerKm ?? null;

  // Plain helpers that take the translator explicitly; the reactive
  // statements below pass $t / $format so a locale switch re-renders them.
  function dueDetail(
    item: AttentionEntry,
    tr: Translator,
    distance: (km: number) => string,
  ) {
    if (item.tone === "confirm") return tr("home.confirmHint");
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
      badge: TONE[item.tone].badge,
      border: TONE[item.tone].border,
      statusLabel: tr(TONE[item.tone].label),
    };
  }

  $: nextDue = data.nextDue
    ? describeAttention(data.nextDue, false, $t, $format.distance)
    : null;
  $: attention = (data.attention ?? []).map((item) =>
    describeAttention(item, garage.length > 1, $t, $format.distance),
  );
</script>

<svelte:head><title>{$t("home.title")} · Moto Track</title></svelte:head>

<!-- The bike home answers one question first: does my bike need anything?
     Adding records is the shell's + (phone bar / sidebar); analysis lives on
     Análises. -->
<section class="grid gap-6">
  <PageHeader title={$t("home.title")} />

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
    <!-- 1. The bike, compact: who it is, how far it has gone, how healthy. -->
    <article
      class="bike-hero panel flex items-center gap-4 p-4 sm:p-5"
      aria-labelledby="hero-name"
    >
      <div
        class="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--panel-invert)] text-white/70 sm:h-24 sm:w-24"
      >
        {#if hero.photoUrl}
          <img
            src={hero.photoUrl}
            alt={$t("home.photoAlt", { name: hero.name })}
            class="absolute inset-0 h-full w-full object-cover"
          />
        {:else}
          <Motorcycle size={24} aria-hidden="true" />
        {/if}
      </div>
      <div class="min-w-0 flex-1">
        {#if hero.modelLabel}
          <p class="truncate text-sm text-[var(--muted)]">{hero.modelLabel}</p>
        {/if}
        <h2 id="hero-name" class="display truncate text-2xl sm:text-3xl">
          {hero.name}
        </h2>
        <p class="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <Odometer size={16} />
          <span class="sr-only">{$t("home.odometer")}</span>
          <span class="numeric font-semibold text-[var(--fg)]">
            {$format.distance(hero.odometer)}
          </span>
        </p>
        <!-- Phones: the score as one line, so the bike's name keeps its width. -->
        <p class="mt-1 text-sm text-[var(--muted)] sm:hidden">
          {$t("home.health")}:
          <span class="numeric font-semibold text-[var(--fg)]"
            >{hero.health.total}</span
          >
          · {$t(HEALTH_KEY[hero.health.status])}
        </p>
      </div>
      <div class="hidden shrink-0 sm:block">
        <p class="label-tech text-center text-[var(--muted)]">
          {$t("home.health")}
        </p>
        <HealthGauge
          compact
          score={hero.health.total}
          status={$t(HEALTH_KEY[hero.health.status])}
        />
      </div>
    </article>

    <!-- 2. The one thing that needs the rider, or a calm all-clear. -->
    {#if nextDue}
      <article
        class="panel border-l-4 p-5 sm:p-6 {nextDue.border}"
        aria-labelledby="next-due-title"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="label-tech text-[var(--muted)]">{$t("home.nextUp")}</p>
          <StatusBadge tone={nextDue.badge}>{nextDue.statusLabel}</StatusBadge>
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
        {#if nextDue.kind === "maintenance" && (nextDue.estimatedCostCents > 0 || nextDue.officialUrl)}
          <p class="mt-3 text-sm text-[var(--muted)]">
            {#if nextDue.estimatedCostCents > 0}
              {$t("dashboard.estimate")}:
              <strong class="numeric text-[var(--fg)]"
                >{$format.money(nextDue.estimatedCostCents)}</strong
              >
            {/if}
            {#if nextDue.officialUrl}
              {#if nextDue.estimatedCostCents > 0}·{/if}
              <a
                class="font-semibold text-[var(--fg)] underline underline-offset-4"
                href={nextDue.officialUrl}
                target="_blank"
                rel="noreferrer"
                >{$t("dashboard.officialManual")}: {nextDue.documentVersion} · {nextDue.pageReference}
                ↗</a
              >
            {/if}
          </p>
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
          class="focus-ring flex min-h-11 items-center rounded text-sm font-semibold text-[var(--fg)] underline underline-offset-4"
          href="/reminders">{$t("dashboard.viewReminders")}</a
        >
      </article>
    {/if}

    {#if attention.length}
      <section class="panel p-5 sm:p-6" aria-labelledby="attention-title">
        <div class="flex items-center justify-between gap-3">
          <h2 id="attention-title" class="label-tech text-[var(--muted)]">
            {$t("home.alsoAttention")}
          </h2>
          <a
            class="focus-ring flex min-h-11 items-center rounded text-sm font-semibold text-[var(--fg)] underline underline-offset-4"
            href="/reminders">{$t("dashboard.viewReminders")}</a
          >
        </div>
        <ul class="mt-1 divide-y divide-[var(--line)]">
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
                <StatusBadge tone={item.badge}>{item.statusLabel}</StatusBadge>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- 3. One headline number; the charts behind it live on Análises. -->
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
    <a
      class="focus-ring flex min-h-11 items-center gap-2 self-start rounded text-sm font-semibold text-[var(--fg)] underline underline-offset-4"
      href="/reports"
    >
      <ChartNoAxesCombined size={16} aria-hidden="true" />
      {$t("home.openInsights")}
    </a>
  {/if}
</section>
