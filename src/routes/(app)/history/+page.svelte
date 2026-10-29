<script lang="ts">
  import { goto } from "$app/navigation";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import { Tire } from "$components/icons";
  import { format, locale, t } from "$lib/i18n/store";
  import { formatMoney, type MessageKey } from "$lib/i18n";
  import type {
    TimelineEntry,
    TimelineFilter,
    TimelineKind,
  } from "$server/domain/timeline";
  import Fuel from "lucide-svelte/icons/fuel";
  import Wrench from "lucide-svelte/icons/wrench";
  import ReceiptText from "lucide-svelte/icons/receipt-text";
  import ShieldCheck from "lucide-svelte/icons/shield-check";
  import History from "lucide-svelte/icons/history";
  import Plus from "lucide-svelte/icons/plus";

  let { data } = $props();

  const FILTERS: Array<{ value: TimelineFilter; label: MessageKey }> = [
    { value: "all", label: "timeline.filterAll" },
    { value: "fuel", label: "timeline.filterFuel" },
    { value: "maintenance", label: "timeline.filterMaintenance" },
    { value: "tires", label: "timeline.filterTires" },
    { value: "expenses", label: "timeline.filterExpenses" },
  ];

  const TONE: Record<TimelineKind, string> = {
    fuel: "var(--cat-fuel)",
    maintenance: "var(--cat-maintenance)",
    tires: "var(--cat-tires)",
    expenses: "var(--cat-fees)",
  };

  const showBikePicker = $derived(data.motorcycles.length > 1);
  const showBikeName = $derived(showBikePicker && data.bike === "all");
  const isEmpty = $derived(data.months.length === 0);

  /** Builds a /history link; changing type or bike restarts at the latest page. */
  function historyHref(next: {
    type?: TimelineFilter;
    bike?: string;
    before?: string | null;
  }) {
    const type = next.type ?? data.filter;
    const bike = next.bike ?? data.bike;
    const params: string[] = [];
    if (type !== "all") params.push(`type=${encodeURIComponent(type)}`);
    if (showBikePicker && bike) params.push(`moto=${encodeURIComponent(bike)}`);
    if (next.before) params.push(`before=${encodeURIComponent(next.before)}`);
    return params.length ? `/history?${params.join("&")}` : "/history";
  }

  function chooseBike(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    goto(historyHref({ bike: value }), { keepFocus: true, noScroll: true });
  }

  function monthLabel(key: string) {
    const label = $format.date(`${key}-01`, {
      month: "long",
      year: "numeric",
    });
    return label.charAt(0).toLocaleUpperCase($locale) + label.slice(1);
  }

  function dayLabel(date: string) {
    return $format.date(date, { day: "2-digit", month: "short" });
  }

  function entryTitle(entry: TimelineEntry) {
    switch (entry.subkind) {
      case "fuel":
        return $t("timeline.fuelTitle");
      case "maintenance":
        return entry.label || $t("timeline.maintenanceTitle");
      case "tires": {
        const position = String(entry.position ?? "").toLowerCase();
        if (position === "dianteiro" || position === "front")
          return $t("timeline.tireFront");
        if (position === "traseiro" || position === "rear")
          return $t("timeline.tireRear");
        return entry.position
          ? `${$t("timeline.tireTitle")} · ${entry.position}`
          : $t("timeline.tireTitle");
      }
      case "insurance":
        return $t("timeline.insuranceTitle");
      default:
        return entry.label || $t("timeline.feeTitle");
    }
  }

  /** Detail after the odometer: litres and station, workshop, tire model… */
  function entryDetails(entry: TimelineEntry) {
    const parts: string[] = [];
    if (entry.kind === "fuel" && entry.liters)
      parts.push(
        $t("timeline.liters", {
          value: $format.number(entry.liters, { maximumFractionDigits: 2 }),
        }),
      );
    if (entry.kind === "tires" && entry.label) parts.push(entry.label);
    if (entry.detail) parts.push(entry.detail);
    if (showBikeName && entry.motorcycleName) parts.push(entry.motorcycleName);
    return parts;
  }

  function money(cents: number, currency = "BRL") {
    return formatMoney($locale, cents, currency);
  }
</script>

<svelte:head>
  <title>{$t("timeline.pageTitle")} · Moto Track</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
  <PageHeader
    title={$t("timeline.pageTitle")}
    description={$t("timeline.pageDescription")}
  />

  <div class="flex flex-col gap-3">
    <nav aria-label={$t("timeline.filterLabel")}>
      <ul class="flex flex-wrap gap-2">
        {#each FILTERS as option (option.value)}
          {@const active = data.filter === option.value}
          <li class="shrink-0">
            <a
              href={historyHref({ type: option.value, before: null })}
              class="focus-ring inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors {active
                ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]'
                : 'border-[var(--line)] bg-[var(--panel)] text-[var(--fg)] hover:border-[var(--fg-soft)]'}"
              aria-current={active ? "page" : undefined}
              data-sveltekit-noscroll
            >
              {$t(option.label)}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    {#if showBikePicker}
      <form method="get" action="/history" class="flex items-end gap-2">
        {#if data.filter !== "all"}
          <input type="hidden" name="type" value={data.filter} />
        {/if}
        <label class="field-group min-w-0 flex-1 sm:max-w-xs">
          <span class="field-label">{$t("timeline.bikeLabel")}</span>
          <select
            name="moto"
            class="field"
            value={data.bike}
            onchange={chooseBike}
          >
            <option value="all">{$t("timeline.allBikes")}</option>
            {#each data.motorcycles as moto (moto.id)}
              <option value={moto.id}>{moto.name}</option>
            {/each}
          </select>
        </label>
        <noscript>
          <button type="submit" class="button-secondary">
            {$t("timeline.applyFilter")}
          </button>
        </noscript>
      </form>
    {/if}
  </div>

  {#if data.loadFailed}
    <p
      class="rounded-md border border-[var(--line)] bg-[var(--info-soft)] px-4 py-3 text-sm text-[var(--fg)]"
      role="status"
    >
      {$t("timeline.loadError")}
    </p>
  {/if}

  {#if isEmpty && !data.nextBefore && !data.before}
    {#if data.filter === "all"}
      <EmptyState
        icon={History}
        title={$t("timeline.emptyTitle")}
        description={$t("timeline.emptyDescription")}
      >
        {#snippet action()}
          <a href="/fuel?new=1" class="button-primary">
            <Plus size={20} aria-hidden="true" />
            {$t("timeline.emptyAction")}
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        compact
        icon={History}
        title={$t("timeline.emptyFilteredTitle")}
        description={$t("timeline.emptyFilteredDescription")}
      />
    {/if}
  {:else}
    {#if isEmpty}
      <p class="py-6 text-center text-sm text-[var(--muted)]">
        {$t("timeline.quietPeriod")}
      </p>
    {/if}

    {#each data.months as month (month.key)}
      <section aria-labelledby="month-{month.key}" class="flex flex-col gap-2">
        <div
          class="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2"
        >
          <h2
            id="month-{month.key}"
            class="display text-xl tracking-tight text-[var(--fg)]"
          >
            {monthLabel(month.key)}
          </h2>
          <p class="text-sm text-[var(--muted)]">
            <span class="sr-only">{$t("timeline.monthTotal")}:</span>
            <span class="numeric font-semibold text-[var(--fg)]">
              {money(month.totalCents)}
            </span>
          </p>
        </div>

        <ul class="flex flex-col">
          {#each month.entries as entry (entry.id)}
            {@const details = entryDetails(entry)}
            <li>
              <a
                href={entry.href}
                class="focus-ring -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-[var(--accent-wash)]"
              >
                <span
                  class="grid h-10 w-10 shrink-0 place-items-center rounded-md"
                  style:color={TONE[entry.kind]}
                  style:background="color-mix(in srgb, {TONE[entry.kind]} 12%, transparent)"
                  aria-hidden="true"
                >
                  {#if entry.kind === "fuel"}
                    <Fuel size={20} />
                  {:else if entry.kind === "maintenance"}
                    <Wrench size={20} />
                  {:else if entry.kind === "tires"}
                    <Tire size={20} />
                  {:else if entry.subkind === "insurance"}
                    <ShieldCheck size={20} />
                  {:else}
                    <ReceiptText size={20} />
                  {/if}
                </span>

                <span class="flex min-w-0 flex-1 flex-col">
                  <span
                    class="truncate text-base font-semibold text-[var(--fg)]"
                  >
                    {entryTitle(entry)}
                  </span>
                  <span class="truncate text-xs text-[var(--muted)]">
                    <time datetime={entry.date}>{dayLabel(entry.date)}</time>
                    {#if entry.odometerKm !== null}
                      · <span class="numeric"
                        >{$format.distance(entry.odometerKm)}</span
                      >
                    {/if}
                    {#each details as part, index (index)}
                      · {part}
                    {/each}
                  </span>
                </span>

                <span
                  class="numeric shrink-0 text-right text-sm font-semibold text-[var(--fg)]"
                >
                  {#if entry.amountCents}
                    {money(entry.amountCents, entry.currency)}
                  {:else}
                    <span class="text-[var(--muted)]">—</span>
                  {/if}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    {#if data.nextBefore || data.before}
      <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
        {#if data.nextBefore}
          <a
            href={historyHref({ before: data.nextBefore })}
            class="button-secondary"
          >
            {$t("timeline.loadMore")}
          </a>
        {/if}
        {#if data.before}
          <a href={historyHref({ before: null })} class="button-secondary">
            {$t("timeline.backToLatest")}
          </a>
        {/if}
      </div>
    {/if}
  {/if}
</div>
