<script lang="ts">
  import { calendarDay } from "$lib/utils/calendar-day";
  import { enhance } from "$app/forms";
  import { afterNavigate, replaceState } from "$app/navigation";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t, format } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import PageOverflowMenu from "$lib/components/app/PageOverflowMenu.svelte";
  import BikeContextBar from "$lib/components/app/BikeContextBar.svelte";
  import SignalStrip, {
    type Signal,
  } from "$lib/components/app/SignalStrip.svelte";
  import ActivityTimeline from "$lib/components/app/ActivityTimeline.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge, {
    type StatusTone,
  } from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import {
    Chain,
    Motorcycle,
    OilCan,
    SparkPlug,
    Tire,
    Workshop,
  } from "$components/icons";
  import CalendarPlus from "lucide-svelte/icons/calendar-plus";
  import Download from "lucide-svelte/icons/download";
  import Package from "lucide-svelte/icons/package";
  import Search from "lucide-svelte/icons/search";
  import Camera from "lucide-svelte/icons/camera";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import Wrench from "lucide-svelte/icons/wrench";
  import MaintenancePhaseFields from "$lib/components/MaintenancePhaseFields.svelte";

  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const km = (value: number) => Number(value).toLocaleString($locale);

  /** Money fields are text inputs (inputmode="decimal"), so prefill them in
   *  the rider's own decimal separator; the server accepts both. */
  const decimalValue = (cents: unknown) => {
    if (cents === null || cents === undefined || cents === "") return "";
    const value = (Number(cents) / 100).toFixed(2);
    return $locale === "en" ? value : value.replace(".", ",");
  };

  type MarketplaceOffer = {
    id: string;
    title: string;
    priceCents: number;
    currency: string;
    permalink: string;
    condition: "new" | "used" | "unknown";
  };
  type MarketplaceState = {
    query: string;
    offers: MarketplaceOffer[];
    mode?: "external-search" | "api";
    error?: string;
    fallbackUrl?: string;
  };
  type PlanRow = Record<string, unknown> & {
    forecast?: { dueDate: string | null; kmPerDay: number | null } | null;
    urgency?: "overdue" | "due_now" | "scheduled";
    due_km?: number | null;
    remaining_km?: number | null;
    progress_percent?: number | null;
    motorcycles?: { name: unknown } | null;
  };

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: hasRecords = data.rows.length > 0;
  $: plans = (data.plans ?? []) as PlanRow[];
  $: hasPlans = plans.length > 0;
  $: marketplaceState = form?.marketplace as MarketplaceState | undefined;

  // Defaults to the shell's active bike (resolved server-side), so the page
  // view and the ?new=1 sheet start on the bike the rider picked. SvelteKit
  // reuses this component when the shell switches bikes, so follow that
  // change too (as /fuel does) while keeping page-local picks in between.
  const activeOrFirstId = () =>
    String(data.activeMotorcycleId ?? data.motorcycles[0]?.id ?? "");
  let selectedMotorcycleId = activeOrFirstId();
  let syncedActiveId: unknown = data.activeMotorcycleId;
  $: if (data.activeMotorcycleId !== syncedActiveId) {
    syncedActiveId = data.activeMotorcycleId;
    selectedMotorcycleId = activeOrFirstId();
  }
  $: currentMotorcycle =
    data.motorcycles.find(
      (m: Record<string, unknown>) =>
        String(m.id) === String(selectedMotorcycleId),
    ) ?? data.motorcycles[0];

  // Client-side type filter over the already-loaded history.
  let filterType = "all";
  $: recordTypes = [
    ...new Set(
      data.rows.map((row: Record<string, unknown>) =>
        String(row.maintenance_type ?? ""),
      ),
    ),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  type MaintenanceRecord = {
    id: string;
    maintenance_type?: string | null;
    date?: string | null;
    motorcycle_id?: string | null;
    motorcycle_name?: string | null;
    odometer_km?: number | string | null;
    workshop?: string | null;
    cost_cents?: number | null;
    description?: string | null;
    maintenance_plan_item_id?: string | null;
    completed_milestone?: number | null;
  };
  $: filteredRows = ((data.rows ?? []) as MaintenanceRecord[]).filter(
    (row: MaintenanceRecord) =>
      filterType === "all" || String(row.maintenance_type ?? "") === filterType,
  );

  let pendingAction = "";
  let formBusy = false;
  let errorMessage = "";

  let logSheet: RecordSheet;
  let planSheet: RecordSheet;
  let partsSheet: RecordSheet;
  let marketplaceSheet: RecordSheet;
  let photosSheet: RecordSheet;
  let confirmDialog: ConfirmDialog;
  let marketplaceQuery = "";

  // Quick-log deep link: /maintenance?new=1 opens the "log service" sheet, then
  // drops the param so a reload or back navigation does not reopen it.
  afterNavigate(({ to }) => {
    if (!to?.url || to.url.searchParams.get("new") !== "1") return;
    if (data.motorcycles.length > 0) logSheet?.open();
    const url = new URL(to.url);
    url.searchParams.delete("new");
    // The router only accepts shallow routing once hydration has settled.
    setTimeout(() => {
      try {
        replaceState(url, {});
      } catch {
        window.history.replaceState(window.history.state, "", url);
      }
    }, 0);
  });

  $: overdueCount = plans.filter((p) => p.urgency === "overdue").length;
  $: dueNowCount = plans.filter((p) => p.urgency === "due_now").length;
  $: totalSpent = data.rows.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum + Number(r.cost_cents ?? 0),
    0,
  );
  $: lastRecord = (data.rows as MaintenanceRecord[])[0];

  function planSignal(
    plans: PlanRow[],
    overdueCount: number,
    dueNowCount: number,
  ): Signal | null {
    if (plans.length === 0) return null;
    const overdue = plans.find((p) => p.urgency === "overdue");
    if (overdue)
      return {
        label: $t("dashboard.urgencyOverdue"),
        value: `${overdueCount}`,
        hint: overdue.maintenance_type
          ? String(overdue.maintenance_type)
          : undefined,
      };
    const dueNow = plans.find((p) => p.urgency === "due_now");
    if (dueNow)
      return {
        label: $t("dashboard.urgencyNow"),
        value: `${dueNowCount}`,
        hint: dueNow.maintenance_type
          ? String(dueNow.maintenance_type)
          : undefined,
      };
    return {
      label: $t("maintenance.dueNextTitle"),
      value: String(plans[0].maintenance_type ?? ""),
      hint: plans[0].due_km ? `${km(Number(plans[0].due_km))} km` : undefined,
    };
  }

  // Only metrics that have data: no dashes at display size.
  $: signals = [
    planSignal(plans, overdueCount, dueNowCount),
    hasRecords
      ? {
          label: $t("maintenance.recordsHeading"),
          value: `${data.rows.length}`,
          hint: lastRecord?.maintenance_type
            ? $t("serviceUx.lastService", {
                type: String(lastRecord.maintenance_type),
              })
            : undefined,
        }
      : null,
    hasRecords
      ? { label: $t("fuel.statsSpend"), value: brl(totalSpent) }
      : null,
  ].filter((signal): signal is Signal => signal !== null);

  /** Domain icon for a service type, by keyword; a wrench otherwise. */
  function serviceIcon(type: unknown) {
    const value = String(type ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (/oleo|oil|lubrifica/.test(value)) return OilCan;
    if (/corrente|chain|relacao|coroa|pinhao|transmissao/.test(value))
      return Chain;
    if (/vela|spark|ignicao/.test(value)) return SparkPlug;
    if (/pneu|tire|tyre/.test(value)) return Tire;
    return Wrench;
  }

  function seedMarketplaceQuery(value: string) {
    marketplaceQuery = value.trim().slice(0, 120);
    marketplaceSheet?.open();
  }

  function openPlanForm() {
    planSheet?.open();
  }

  function urgencyLabel(urgency: PlanRow["urgency"]) {
    if (urgency === "overdue") return $t("dashboard.urgencyOverdue");
    if (urgency === "due_now") return $t("dashboard.urgencyNow");
    return $t("maintenance.urgencyScheduled");
  }

  function urgencyTone(urgency: PlanRow["urgency"]): StatusTone {
    if (urgency === "overdue") return "overdue";
    if (urgency === "due_now") return "due";
    return "ok";
  }

  // Red (--accent) only for overdue work; --danger is for destructive actions.
  function urgencyColor(urgency: PlanRow["urgency"]) {
    if (urgency === "overdue") return "var(--accent)";
    if (urgency === "due_now") return "var(--warning)";
    return "var(--success)";
  }

  function conditionLabel(condition: MarketplaceOffer["condition"]) {
    if (condition === "new") return $t("maintenance.marketplaceConditionNew");
    if (condition === "used") return $t("maintenance.marketplaceConditionUsed");
    return $t("maintenance.marketplaceConditionUnknown");
  }

  function marketplaceErrorLabel(code: string) {
    if (code === "credentials-required")
      return $t("maintenance.marketplaceCredentialHint");
    if (code === "invalid-query")
      return $t("maintenance.marketplaceInvalidQuery");
    if (code === "rate-limited")
      return $t("maintenance.marketplaceRateLimited");
    if (code === "timeout") return $t("maintenance.marketplaceTimeout");
    if (code === "malformed-response")
      return $t("maintenance.marketplaceMalformed");
    return $t("maintenance.marketplaceError");
  }

  /** Success goes to a toast (the sheet closes, so an inline note was easy to
   *  miss); failures stay inline as an alert. */
  const finishStatus = (
    result: { type: string; data?: Record<string, unknown> },
    successMessage?: string,
  ) => {
    if (result.type === "success") {
      errorMessage = "";
      if (successMessage) showToast(successMessage);
    } else if (result.type === "failure") {
      errorMessage = String(result.data?.message ?? $t("error.serverBody"));
    } else if (result.type === "error") {
      errorMessage = $t("error.serverBody");
    }
  };

  const enhanceLogSubmit: SubmitFunction = () => {
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result, $t("serviceUx.serviceSaved"));
      if (result.type === "success") {
        logSheet?.close("success");
      }
      await update();
    };
  };

  const enhancePlanSubmit: SubmitFunction = () => {
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result, $t("serviceUx.planSaved"));
      if (result.type === "success") {
        planSheet?.close("success");
      }
      await update();
    };
  };

  function enhanceAction(
    action: string,
    successMessage?: () => string,
  ): SubmitFunction {
    return () => {
      pendingAction = action;
      errorMessage = "";
      return async ({ result, update }) => {
        try {
          finishStatus(result, successMessage?.());
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }

  function enhanceDelete(action: string): SubmitFunction {
    return async ({ cancel }) => {
      const confirmed = await confirmDialog.ask($t("feature.confirmDelete"));
      if (!confirmed) {
        cancel();
        return;
      }

      pendingAction = action;
      errorMessage = "";
      return async ({ result, update }) => {
        try {
          finishStatus(result, $t("serviceUx.deleted"));
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }

  const overflowItemClass =
    "focus-ring flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] transition hover:bg-[var(--panel-sunken)]";
  const iconTileClass =
    "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--panel-sunken)] text-[var(--muted)]";
</script>

<div
  class="maintenance-page grid gap-6"
  aria-busy={formBusy || Boolean(pendingAction)}
>
  <PageHeader
    title={$t("maintenance.pageTitle")}
    description={$t("maintenance.pageSubtitle")}
  >
    <svelte:fragment slot="actions">
      {#if hasMotorcycles}
        <PageAction
          label={$t("serviceUx.logService")}
          ariaLabel={$t("serviceUx.logService")}
          on:click={() => logSheet?.open()}
        />
      {/if}
    </svelte:fragment>

    <svelte:fragment slot="overflow">
      <PageOverflowMenu label={$t("authenticatedUx.moreActions")}>
        {#if hasMotorcycles}
          <button
            type="button"
            class={overflowItemClass}
            on:click={openPlanForm}
          >
            <CalendarPlus size={16} aria-hidden="true" />
            <span>{$t("authenticatedUx.scheduleMaintenance")}</span>
          </button>
        {/if}
        <a class={overflowItemClass} href="/maintenance/workshops">
          <Workshop size={16} aria-hidden="true" />
          <span>{$t("maintenance.compareWorkshops")}</span>
        </a>
        <button
          type="button"
          class={overflowItemClass}
          on:click={() => partsSheet?.open()}
        >
          <Package size={16} aria-hidden="true" />
          <span>{$t("maintenance.partsHeading")}</span>
        </button>
        <button
          type="button"
          class={overflowItemClass}
          on:click={() => marketplaceSheet?.open()}
        >
          <Search size={16} aria-hidden="true" />
          <span>{$t("maintenance.marketplaceHeading")}</span>
        </button>
        <button
          type="button"
          class={overflowItemClass}
          on:click={() => photosSheet?.open()}
        >
          <Camera size={16} aria-hidden="true" />
          <span>{$t("maintenance.photosHeading")}</span>
        </button>
        <a class={overflowItemClass} href="/maintenance/export.csv">
          <Download size={16} aria-hidden="true" />
          <span>{$t("common.exportCsv")}</span>
        </a>
      </PageOverflowMenu>
    </svelte:fragment>
  </PageHeader>

  {#if hasMotorcycles}
    <BikeContextBar
      name={currentMotorcycle
        ? String(currentMotorcycle.name)
        : $t("maintenance.bikeFallback")}
      model={currentMotorcycle
        ? `${currentMotorcycle.brand || ""} ${currentMotorcycle.model || ""}`.trim()
        : ""}
      odometerKm={currentMotorcycle?.current_odometer_km ?? null}
    >
      <svelte:fragment slot="selection">
        {#if data.motorcycles.length > 1}
          <div class="flex items-center gap-2">
            <label for="maintenance-bike-select" class="sr-only">
              {$t("authenticatedUx.selectBike")}
            </label>
            <select
              id="maintenance-bike-select"
              class="field px-2 py-1 text-sm"
              bind:value={selectedMotorcycleId}
              aria-label={$t("authenticatedUx.selectBike")}
            >
              {#each data.motorcycles as moto (moto.id)}
                <option value={moto.id}>{moto.name}</option>
              {/each}
            </select>
          </div>
        {/if}
      </svelte:fragment>
    </BikeContextBar>
  {/if}

  {#if errorMessage || form?.message || data.errorMessage}
    <div
      class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
      aria-live="assertive"
    >
      {errorMessage || form?.message || data.errorMessage}
    </div>
  {/if}

  <ConfirmDialog
    bind:this={confirmDialog}
    confirmLabel={$t("common.delete")}
    destructive
  />

  <datalist id="maintenance-type-suggestions">
    <option value="Troca de óleo"></option>
    <option value="Filtro de óleo"></option>
    <option value="Corrente e retentores"></option>
    <option value="Freios"></option>
    <option value="Velas"></option>
    <option value="Pneus"></option>
    <option value="Rolamentos"></option>
    <option value="Suspensão"></option>
    <option value="Valvulinas"></option>
  </datalist>

  {#if !hasMotorcycles}
    <EmptyState
      icon={Motorcycle}
      title={$t("serviceUx.noMotorcyclesTitle")}
      description={$t("maintenance.noMotorcyclesHint")}
    >
      {#snippet action()}
        <a class="button-primary min-h-11" href="/garage">
          {$t("maintenance.goToGarage")}
        </a>
      {/snippet}
    </EmptyState>
  {:else if !hasPlans && !hasRecords}
    <EmptyState
      icon={Wrench}
      title={$t("serviceUx.maintenanceEmptyTitle")}
      description={$t("maintenance.emptyRecordsHint")}
    >
      {#snippet action()}
        <button
          class="button-primary min-h-11"
          type="button"
          on:click={() => logSheet?.open()}
        >
          {$t("serviceUx.logService")}
        </button>
      {/snippet}
    </EmptyState>
  {:else}
    <SignalStrip {signals} />

    <!-- UPCOMING / DUE MAINTENANCE PLANS (lead with upcoming work) -->
    <section class="grid gap-3" aria-labelledby="maintenance-due-heading">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="maintenance-due-heading" class="display text-2xl">
            {$t("maintenance.dueNextTitle")}
          </h2>
          {#if hasPlans}
            <p class="text-sm text-[var(--muted)]">
              {$t("maintenance.dueNextHint")}
            </p>
          {/if}
        </div>
        {#if hasPlans}
          <button
            class="button-secondary min-h-11"
            type="button"
            on:click={openPlanForm}
          >
            {$t("authenticatedUx.scheduleMaintenance")}
          </button>
        {/if}
      </div>

      {#if !hasPlans}
        <EmptyState
          compact
          icon={CalendarPlus}
          title={$t("maintenance.noPlans")}
          description={$t("serviceUx.noPlansHint")}
        >
          {#snippet action()}
            <button
              class="button-secondary min-h-11"
              type="button"
              on:click={openPlanForm}
            >
              {$t("maintenance.openPlanForm")}
            </button>
          {/snippet}
        </EmptyState>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          {#each plans as plan (plan.id)}
            {@const urgency = plan.urgency ?? "scheduled"}
            <article class="panel grid gap-3 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex min-w-0 items-start gap-3">
                  <span class={iconTileClass} aria-hidden="true">
                    <svelte:component
                      this={serviceIcon(plan.maintenance_type)}
                      size={20}
                    />
                  </span>
                  <div class="min-w-0">
                    <StatusBadge tone={urgencyTone(urgency)}>
                      {urgencyLabel(urgency)}
                    </StatusBadge>
                    <h3 class="display mt-1 truncate text-xl">
                      {String(plan.maintenance_type ?? "")}
                    </h3>
                    <p class="text-sm text-[var(--muted)]">
                      {plan.motorcycles?.name ?? $t("maintenance.bikeFallback")}
                    </p>
                  </div>
                </div>
                <form
                  method="POST"
                  action="?/deletePlan"
                  use:enhance={enhanceDelete(`delete-plan:${plan.id}`)}
                  aria-busy={pendingAction === `delete-plan:${plan.id}`}
                  class="shrink-0"
                >
                  <input type="hidden" name="id" value={String(plan.id)} />
                  <button
                    class="button-danger min-h-11 px-3 py-1"
                    disabled={pendingAction === `delete-plan:${plan.id}`}
                    type="submit"
                    aria-label={`${$t("common.delete")} ${String(plan.maintenance_type ?? "")}`}
                    title={$t("common.delete")}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </form>
              </div>

              {#if plan.progress_percent !== null && plan.progress_percent !== undefined}
                <div>
                  <div
                    class="flex items-center justify-between text-sm text-[var(--muted)]"
                  >
                    <span>
                      {$t("maintenance.progressKm", {
                        done: km(
                          Math.max(
                            Number(plan.current_km ?? 0) -
                              Number(plan.last_done_km ?? 0),
                            0,
                          ),
                        ),
                        total: km(Number(plan.interval_km)),
                      })}
                    </span>
                    <span class="numeric">{plan.progress_percent}%</span>
                  </div>
                  <div
                    class="mt-1 h-2 overflow-hidden rounded-full bg-[var(--line)]"
                    role="img"
                    aria-label={`${plan.progress_percent}%`}
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      style={`width:${plan.progress_percent}%;background:${urgencyColor(urgency)}`}
                    ></div>
                  </div>
                </div>
              {:else if plan.due_km != null}
                <p
                  class="text-sm {urgency === 'overdue'
                    ? 'font-semibold text-[var(--accent)]'
                    : 'text-[var(--muted)]'}"
                >
                  {urgency === "overdue"
                    ? $t("maintenance.overdueAtKm", {
                        count: km(Number(plan.due_km)),
                      })
                    : `${$t("maintenance.nextDueAt")} ${km(Number(plan.due_km))} ${$t("maintenance.distanceUnit")}`}
                </p>
              {:else if urgency !== "scheduled"}
                <p class="text-sm" style={`color:${urgencyColor(urgency)}`}>
                  {urgency === "overdue"
                    ? $t("dashboard.confidenceNotDone")
                    : $t("dashboard.confidenceUnknown")}
                </p>
              {/if}

              {#if plan.forecast?.dueDate}
                <p class="text-sm text-[var(--muted)]">
                  {$t("forecast.nextDate")}: {$format.date(
                    plan.forecast.dueDate,
                  )}
                  {#if plan.forecast.kmPerDay}
                    · {$t("forecast.observedPace", {
                      count: Math.round(plan.forecast.kmPerDay),
                    })}
                  {/if}
                </p>
              {/if}
              {#if plan.is_phased_schedule && !plan.is_relative_replacement}
                <p class="text-sm text-[var(--muted)]">
                  {$t("maintenance.nextReview")}:
                  {plan.next_milestone == null
                    ? $t("maintenance.confirmBooklet")
                    : `#${plan.next_milestone}`}
                </p>
              {/if}

              <div
                class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-sm text-[var(--muted)]"
              >
                {#if Number(plan.estimated_cost_cents ?? 0) > 0}
                  <span>
                    {$t("dashboard.estimate")}: {brl(
                      Number(plan.estimated_cost_cents),
                    )}
                  </span>
                {/if}
                {#if plan.remaining_km != null && Number(plan.remaining_km) > 0}
                  <span>
                    {$t("maintenance.remainingKm", {
                      count: km(Number(plan.remaining_km)),
                    })}
                  </span>
                {/if}
                {#if plan.initial_history_status === "not_done"}
                  <span class="text-[var(--warning)]">
                    {$t("maintenance.historyNotDone")}
                  </span>
                {:else if plan.initial_history_status === "unknown"}
                  <span>{$t("maintenance.historyUnknown")}</span>
                {/if}
                {#if plan.official_url}
                  <a
                    class="font-semibold text-[var(--fg)] underline underline-offset-4"
                    href={String(plan.official_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {$t("dashboard.officialManual")} ↗
                  </a>
                {/if}
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  class="button-secondary min-h-11 px-3 py-1 text-sm"
                  type="button"
                  on:click={() =>
                    seedMarketplaceQuery(
                      `${String(plan.motorcycles?.name ?? "")} ${String(plan.maintenance_type ?? "")}`,
                    )}
                >
                  {$t("maintenance.marketplaceSeedPlan")}
                </button>
                <details class="min-w-0 flex-1">
                  <summary
                    class="focus-ring flex min-h-11 cursor-pointer items-center rounded px-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                  >
                    {$t("maintenance.editHistory")}
                  </summary>
                  <form
                    class="mt-2 grid gap-3"
                    method="POST"
                    action="?/updateHistory"
                    use:enhance={enhanceAction(`history:${plan.id}`, () =>
                      $t("serviceUx.historySaved"),
                    )}
                    aria-busy={pendingAction === `history:${plan.id}`}
                  >
                    <input type="hidden" name="plan_item_id" value={plan.id} />
                    <div class="field-group">
                      <label
                        class="field-label"
                        for={`history-${plan.id}-status`}
                      >
                        {$t("maintenance.historyStatusLabel")}
                      </label>
                      <select
                        class="field"
                        id={`history-${plan.id}-status`}
                        name="initial_history_status"
                        value={String(
                          plan.baseline_history_status ?? "unknown",
                        )}
                      >
                        <option value="confirmed_done"
                          >{$t("history.confirmedDone")}</option
                        >
                        <option value="not_done">{$t("history.notDone")}</option
                        >
                        <option value="unknown">{$t("history.unknown")}</option>
                      </select>
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`history-${plan.id}-km`}>
                        {$t("maintenance.lastDoneKmLabel")}
                      </label>
                      <input
                        class="field"
                        id={`history-${plan.id}-km`}
                        name="last_done_km"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        value={plan.baseline_last_done_km ?? ""}
                      />
                    </div>
                    <p class="text-sm text-[var(--muted)]">
                      {$t("maintenance.historyEditHint")}
                    </p>
                    {#if plan.is_phased_schedule}
                      <MaintenancePhaseFields
                        plans={[plan]}
                        planId={String(plan.id)}
                        completedMilestone={plan.baseline_completed_milestone ==
                        null
                          ? ""
                          : Number(plan.baseline_completed_milestone)}
                        fieldName="last_completed_milestone"
                        showPlanSelector={false}
                        allowZero={true}
                      />
                    {/if}
                    <div class="field-group">
                      <label
                        class="field-label"
                        for={`history-${plan.id}-date`}
                      >
                        {$t("forecast.lastServiceDate")}
                      </label>
                      <input
                        class="field"
                        id={`history-${plan.id}-date`}
                        name="last_done_date"
                        type="date"
                        value={String(plan.baseline_last_done_date ?? "").slice(
                          0,
                          10,
                        )}
                        max={calendarDay()}
                      />
                    </div>
                    <button
                      class="button-secondary min-h-11 justify-self-start"
                      disabled={pendingAction === `history:${plan.id}`}
                      type="submit"
                    >
                      {$t("maintenance.saveHistory")}
                    </button>
                  </form>
                </details>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <!-- COMPLETED SERVICE HISTORY TIMELINE -->
    <section class="grid gap-3" aria-labelledby="maintenance-history-heading">
      <div
        class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <h2 id="maintenance-history-heading" class="display text-2xl">
          {$t("maintenance.recordsHeading")}
        </h2>
        {#if recordTypes.length > 1}
          <div class="field-group min-w-0 sm:max-w-xs">
            <label class="field-label sr-only" for="maintenance-filter-type">
              {$t("maintenance.maintenanceType")}
            </label>
            <select
              class="field"
              id="maintenance-filter-type"
              bind:value={filterType}
            >
              <option value="all">{$t("maintenance.filterAllTypes")}</option>
              {#each recordTypes as type (type)}
                <option value={type}>{type}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      {#if !hasRecords}
        <EmptyState
          compact
          icon={Wrench}
          title={$t("maintenance.emptyRecords")}
          description={$t("maintenance.emptyRecordsHint")}
        >
          {#snippet action()}
            <button
              class="button-primary min-h-11"
              type="button"
              on:click={() => logSheet?.open()}
            >
              {$t("serviceUx.logService")}
            </button>
          {/snippet}
        </EmptyState>
      {:else}
        <ActivityTimeline title="" items={filteredRows}>
          <div slot="item" let:item>
            {@const row = item}
            {@const recordPhotos = data.photos.filter(
              (p) => String(p.maintenance_record_id) === String(row.id),
            )}
            <article class="panel grid gap-3 p-4">
              <div
                class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
              >
                <div class="flex min-w-0 items-start gap-3">
                  <span class={iconTileClass} aria-hidden="true">
                    <svelte:component
                      this={serviceIcon(row.maintenance_type)}
                      size={20}
                    />
                  </span>
                  <div class="min-w-0">
                    <p
                      class="flex flex-wrap items-center gap-x-2 text-sm text-[var(--muted)]"
                    >
                      <span>
                        {row.date ? $format.date(String(row.date)) : ""}
                      </span>
                      {#if row.motorcycle_name}
                        <span aria-hidden="true">·</span>
                        <span>{String(row.motorcycle_name)}</span>
                      {/if}
                      {#if row.odometer_km != null}
                        <span aria-hidden="true">·</span>
                        <span class="numeric">
                          {km(Number(row.odometer_km))} km
                        </span>
                      {/if}
                    </p>
                    <h3 class="display mt-1 truncate text-xl">
                      {String(row.maintenance_type ?? "")}
                    </h3>
                    {#if row.workshop}
                      <p class="text-sm text-[var(--muted)]">
                        {$t("maintenance.workshopLabel")}: {String(
                          row.workshop,
                        )}
                      </p>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-3 self-end sm:self-start">
                  <span class="display numeric text-lg text-[var(--fg)]">
                    {brl(Number(row.cost_cents ?? 0))}
                  </span>
                  <form
                    method="POST"
                    action="?/deleteRecord"
                    use:enhance={enhanceDelete(`delete-record:${row.id}`)}
                    aria-busy={pendingAction === `delete-record:${row.id}`}
                  >
                    <input type="hidden" name="_intent" value="delete" />
                    <input type="hidden" name="id" value={String(row.id)} />
                    <button
                      class="button-danger min-h-11 px-3 py-1"
                      type="submit"
                      disabled={pendingAction === `delete-record:${row.id}`}
                      aria-label={`${$t("common.delete")} ${String(row.maintenance_type ?? "")}`}
                      title={$t("common.delete")}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </div>

              {#if row.description}
                <p class="whitespace-pre-line text-sm text-[var(--muted)]">
                  {String(row.description)}
                </p>
              {/if}

              <!-- Record details disclosure: photos and edit form -->
              <details class="border-t border-[var(--line)] pt-2">
                <summary
                  class="focus-ring flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                >
                  <span
                    >{$t("feature.editRecord")} · {$t(
                      "maintenance.photosHeading",
                    )} ({recordPhotos.length})</span
                  >
                </summary>

                <div class="mt-3 grid gap-4">
                  <!-- Attached photos -->
                  {#if recordPhotos.length > 0}
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {#each recordPhotos as photo (photo.id)}
                        <div
                          class="overflow-hidden rounded border border-[var(--line)]"
                        >
                          <img
                            class="aspect-video w-full object-cover"
                            src={`/maintenance/photos/${photo.id}`}
                            alt={String(
                              photo.caption || $t("maintenance.photoAlt"),
                            )}
                          />
                          <div
                            class="flex items-center justify-between gap-2 p-2 text-sm"
                          >
                            <span class="truncate text-[var(--muted)]"
                              >{photo.caption || ""}</span
                            >
                            <form
                              method="POST"
                              action="?/deletePhoto"
                              use:enhance={enhanceDelete(
                                `delete-photo:${photo.id}`,
                              )}
                              aria-busy={pendingAction ===
                                `delete-photo:${photo.id}`}
                            >
                              <input type="hidden" name="id" value={photo.id} />
                              <button
                                class="button-danger min-h-11 px-3 py-1"
                                disabled={pendingAction ===
                                  `delete-photo:${photo.id}`}
                                type="submit"
                                aria-label={`${$t("common.delete")} ${$t("maintenance.photoAlt")}`}
                                title={$t("common.delete")}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </form>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  <!-- Upload photo form for this record -->
                  <form
                    class="grid gap-3 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3"
                    method="POST"
                    action="?/uploadPhoto"
                    enctype="multipart/form-data"
                    use:enhance={enhanceAction(`photo:${row.id}`, () =>
                      $t("serviceUx.photoSaved"),
                    )}
                    aria-busy={pendingAction === `photo:${row.id}`}
                  >
                    <input
                      type="hidden"
                      name="maintenance_record_id"
                      value={String(row.id)}
                    />
                    <p class="text-sm font-semibold">
                      {$t("maintenance.photoFormTitle")}
                    </p>
                    <div class="grid gap-3 sm:grid-cols-2">
                      <div class="field-group">
                        <label
                          class="field-label"
                          for={`photo-${row.id}-caption`}
                        >
                          {$t("maintenance.caption")}
                        </label>
                        <input
                          class="field"
                          id={`photo-${row.id}-caption`}
                          name="caption"
                        />
                      </div>
                      <div class="field-group">
                        <label class="field-label" for={`photo-${row.id}-file`}>
                          {$t("maintenance.photoAlt")}
                        </label>
                        <input
                          class="field"
                          id={`photo-${row.id}-file`}
                          name="photo"
                          type="file"
                          accept="image/*"
                          required
                        />
                      </div>
                    </div>
                    <button
                      class="button-secondary min-h-11 justify-self-start"
                      disabled={pendingAction === `photo:${row.id}`}
                      type="submit"
                    >
                      {$t("maintenance.sendPhoto")}
                    </button>
                  </form>

                  <!-- Edit record form -->
                  <form
                    class="grid gap-3 rounded border border-[var(--line)] p-3 md:grid-cols-3"
                    method="POST"
                    action="?/logCompleted"
                    use:enhance={enhanceAction(`edit-record:${row.id}`, () =>
                      $t("common.actionSuccess"),
                    )}
                    aria-busy={pendingAction === `edit-record:${row.id}`}
                  >
                    <input type="hidden" name="_intent" value="update" />
                    <input type="hidden" name="id" value={String(row.id)} />
                    <MaintenancePhaseFields
                      {plans}
                      planId={String(row.maintenance_plan_item_id ?? "")}
                      completedMilestone={row.completed_milestone ?? null}
                    />
                    <div class="field-group">
                      <label
                        class="field-label"
                        for={`edit-${row.id}-motorcycle`}
                      >
                        {$t("maintenance.bikeFallback")}
                      </label>
                      <select
                        class="field"
                        id={`edit-${row.id}-motorcycle`}
                        name="motorcycle_id"
                        required
                      >
                        {#each data.motorcycles as moto (moto.id)}
                          <option
                            value={moto.id}
                            selected={String(row.motorcycle_id ?? "") ===
                              String(moto.id)}
                          >
                            {moto.name}
                          </option>
                        {/each}
                      </select>
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${row.id}-date`}>
                        {$t("maintenance.recordDateLabel")}
                      </label>
                      <input
                        class="field"
                        id={`edit-${row.id}-date`}
                        type="date"
                        name="date"
                        value={String(row.date ?? "")}
                        required
                      />
                    </div>
                    <div class="field-group">
                      <label
                        class="field-label"
                        for={`edit-${row.id}-odometer`}
                      >
                        {$t("maintenance.recordOdometerLabel")}
                      </label>
                      <input
                        class="field"
                        id={`edit-${row.id}-odometer`}
                        type="number"
                        inputmode="numeric"
                        min="0"
                        name="odometer_km"
                        value={String(row.odometer_km ?? "")}
                        required
                      />
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${row.id}-type`}>
                        {$t("maintenance.maintenanceType")}
                      </label>
                      <input
                        class="field"
                        id={`edit-${row.id}-type`}
                        name="maintenance_type"
                        value={String(row.maintenance_type ?? "")}
                        required
                        list="maintenance-type-suggestions"
                      />
                    </div>
                    <div class="field-group">
                      <label
                        class="field-label"
                        for={`edit-${row.id}-workshop`}
                      >
                        {$t("maintenance.workshopLabel")}
                      </label>
                      <input
                        class="field"
                        id={`edit-${row.id}-workshop`}
                        name="workshop"
                        value={String(row.workshop ?? "")}
                      />
                    </div>
                    <div class="field-group">
                      <label class="field-label" for={`edit-${row.id}-cost`}>
                        {$t("maintenance.costLabel")}
                      </label>
                      <input
                        class="field"
                        id={`edit-${row.id}-cost`}
                        type="text"
                        inputmode="decimal"
                        autocomplete="off"
                        name="cost_cents"
                        value={decimalValue(row.cost_cents ?? 0)}
                      />
                    </div>
                    <div class="field-group md:col-span-3">
                      <label
                        class="field-label"
                        for={`edit-${row.id}-description`}
                      >
                        {$t("maintenance.descriptionLabel")}
                      </label>
                      <textarea
                        class="field min-h-16"
                        id={`edit-${row.id}-description`}
                        name="description"
                        >{String(row.description ?? "")}</textarea
                      >
                    </div>
                    <div class="flex items-end md:col-span-3">
                      <button
                        class="button-primary min-h-11"
                        type="submit"
                        disabled={pendingAction === `edit-record:${row.id}`}
                      >
                        {$t("common.saveChanges")}
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            </article>
          </div>
        </ActivityTimeline>
      {/if}
    </section>
  {/if}

  <!-- LOG SERVICE RECORD SHEET -->
  <RecordSheet
    bind:this={logSheet}
    title={$t("authenticatedUx.logCompleted")}
    description={$t("authenticatedUx.logCompletedDesc")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/logCompleted"
      use:enhance={enhanceLogSubmit}
      aria-busy={formBusy}
    >
      <input type="hidden" name="_intent" value="create" />
      <div class="field-group">
        <label class="field-label" for="record-motorcycle">
          {$t("maintenance.bikeFallback")}
        </label>
        <select
          class="field"
          id="record-motorcycle"
          name="motorcycle_id"
          required
          disabled={!hasMotorcycles}
        >
          {#each data.motorcycles as moto (moto.id)}
            <option
              value={moto.id}
              selected={String(moto.id) === String(selectedMotorcycleId)}
            >
              {moto.name}
            </option>
          {/each}
        </select>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="record-date">
            {$t("maintenance.recordDateLabel")}
          </label>
          <input
            class="field"
            id="record-date"
            type="date"
            name="date"
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="record-odometer">
            {$t("maintenance.recordOdometerLabel")}
          </label>
          <input
            class="field"
            id="record-odometer"
            type="number"
            inputmode="numeric"
            min="0"
            name="odometer_km"
            required
          />
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="record-type">
          {$t("maintenance.maintenanceType")}
        </label>
        <input
          class="field"
          id="record-type"
          name="maintenance_type"
          required
          list="maintenance-type-suggestions"
        />
      </div>

      <div class="field-group">
        <label class="field-label" for="record-description">
          {$t("maintenance.descriptionLabel")}
        </label>
        <textarea
          class="field min-h-16"
          id="record-description"
          name="description"
        ></textarea>
      </div>

      <MaintenancePhaseFields {plans} />

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="record-workshop">
            {$t("maintenance.workshopLabel")}
          </label>
          <input class="field" id="record-workshop" name="workshop" />
        </div>
        <div class="field-group">
          <label class="field-label" for="record-cost">
            {$t("maintenance.costLabel")}
          </label>
          <input
            class="field"
            id="record-cost"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            name="cost_cents"
          />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="record-interval-km">
            {$t("maintenance.intervalKm")}
          </label>
          <input
            class="field"
            id="record-interval-km"
            type="number"
            inputmode="numeric"
            min="0"
            name="interval_km"
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="record-interval-days">
            {$t("maintenance.intervalDays")}
          </label>
          <input
            class="field"
            id="record-interval-days"
            type="number"
            inputmode="numeric"
            min="0"
            name="interval_days"
          />
        </div>
      </div>

      <button
        class="button-primary min-h-11 w-full"
        type="submit"
        disabled={!hasMotorcycles || formBusy}
      >
        {$t("common.save")}
      </button>
    </form>
  </RecordSheet>

  <!-- SCHEDULE PLAN RECORD SHEET -->
  <RecordSheet
    bind:this={planSheet}
    title={$t("authenticatedUx.scheduleMaintenance")}
    description={$t("authenticatedUx.scheduleMaintenanceDesc")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/savePlan"
      use:enhance={enhancePlanSubmit}
      aria-busy={formBusy}
    >
      <div class="field-group">
        <label class="field-label" for="plan-motorcycle">
          {$t("maintenance.bikeFallback")}
        </label>
        <select
          class="field"
          id="plan-motorcycle"
          name="motorcycle_id"
          required
          disabled={!hasMotorcycles}
        >
          <option value="">
            {hasMotorcycles
              ? $t("common.select")
              : $t("maintenance.noMotorcyclesSelect")}
          </option>
          {#each data.motorcycles as m (m.id)}
            <option
              value={m.id}
              selected={String(m.id) === String(selectedMotorcycleId)}
            >
              {m.name}
            </option>
          {/each}
        </select>
      </div>

      <div class="field-group">
        <label class="field-label" for="plan-type">
          {$t("maintenance.maintenanceType")}
        </label>
        <input
          class="field"
          id="plan-type"
          name="maintenance_type"
          required
          list="maintenance-type-suggestions"
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="plan-interval-km">
            {$t("maintenance.intervalKm")}
          </label>
          <input
            class="field"
            id="plan-interval-km"
            name="interval_km"
            type="number"
            inputmode="numeric"
            min="1"
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="plan-interval-days">
            {$t("maintenance.intervalDays")}
          </label>
          <input
            class="field"
            id="plan-interval-days"
            name="interval_days"
            type="number"
            inputmode="numeric"
            min="1"
          />
        </div>
      </div>

      <label class="flex items-start gap-2 text-sm">
        <input
          class="mt-1"
          type="checkbox"
          name="convert_manufacturer_plan"
          value="true"
        />
        <span
          >{$t("maintenance.convertManufacturerPlan")}
          <span class="mt-1 block text-sm text-[var(--muted)]"
            >{$t("maintenance.convertManufacturerPlanHelp")}</span
          >
        </span>
      </label>

      <button
        class="button-primary min-h-11 w-full"
        disabled={!hasMotorcycles || formBusy}
        type="submit"
      >
        {$t("maintenance.savePlan")}
      </button>
    </form>
  </RecordSheet>

  <!-- PARTS RECORD SHEET -->
  <RecordSheet
    bind:this={partsSheet}
    title={$t("maintenance.partsHeading")}
    description={$t("maintenance.marketplaceHint")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <div class="grid gap-6">
      <form
        class="grid gap-3"
        method="POST"
        action="?/savePart"
        use:enhance={enhanceAction("part", () => $t("serviceUx.partSaved"))}
        aria-busy={pendingAction === "part"}
      >
        <h3 class="font-semibold">{$t("maintenance.partsFormTitle")}</h3>
        <div class="field-group">
          <label class="field-label" for="part-name">
            {$t("maintenance.partName")}
          </label>
          <input class="field" id="part-name" name="name" required />
        </div>
        <div class="field-group">
          <label class="field-label" for="part-manufacturer">
            {$t("maintenance.manufacturer")}
          </label>
          <input class="field" id="part-manufacturer" name="manufacturer" />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="part-price">
              {$t("maintenance.price")}
            </label>
            <input
              class="field"
              id="part-price"
              name="price"
              type="text"
              inputmode="decimal"
              autocomplete="off"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="part-stock">
              {$t("maintenance.stockQuantity")}
            </label>
            <input
              class="field"
              id="part-stock"
              name="stock_quantity"
              type="number"
              inputmode="numeric"
              value="0"
              min="0"
            />
          </div>
        </div>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input name="track_stock" type="checkbox" value="true" />
          {$t("maintenance.trackStock")}
        </label>
        <button
          class="button-primary min-h-11 w-full"
          disabled={pendingAction === "part"}
          type="submit"
        >
          {$t("maintenance.savePart")}
        </button>
      </form>

      <div class="grid gap-2 border-t border-[var(--line)] pt-4">
        <h3 class="font-semibold">{$t("maintenance.partsListHeading")}</h3>
        {#each data.parts as part (part.id)}
          <article
            class="flex min-w-0 flex-col justify-between gap-3 rounded border border-[var(--line)] p-3 sm:flex-row sm:items-start"
          >
            <span class="min-w-0 break-words text-sm">
              {part.name}
              {part.manufacturer ? `· ${part.manufacturer}` : ""} · {brl(
                Number(part.price_cents ?? 0),
              )}
              {part.track_stock
                ? `· ${$t("maintenance.stockSuffix")} ${part.stock_quantity}`
                : ""}
            </span>
            <div class="flex shrink-0 gap-2">
              <button
                class="button-secondary min-h-11 px-3 py-1 text-sm"
                type="button"
                on:click={() => seedMarketplaceQuery(String(part.name ?? ""))}
              >
                {$t("maintenance.marketplaceSeedPart")}
              </button>
              <form
                method="POST"
                action="?/deletePart"
                use:enhance={enhanceDelete(`delete-part:${part.id}`)}
                aria-busy={pendingAction === `delete-part:${part.id}`}
              >
                <input type="hidden" name="id" value={part.id} />
                <button
                  class="button-danger min-h-11 px-3 py-1"
                  disabled={pendingAction === `delete-part:${part.id}`}
                  type="submit"
                  aria-label={`${$t("common.delete")} ${String(part.name ?? "")}`}
                  title={$t("common.delete")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </form>
            </div>
          </article>
        {:else}
          <p class="text-sm text-[var(--muted)]">{$t("maintenance.noParts")}</p>
        {/each}
      </div>
    </div>
  </RecordSheet>

  <!-- MARKETPLACE SEARCH RECORD SHEET -->
  <RecordSheet
    bind:this={marketplaceSheet}
    title={$t("maintenance.marketplaceHeading")}
    description={$t("maintenance.marketplaceHint")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <div class="grid gap-4">
      <form
        class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        method="POST"
        action="?/searchMarketplace"
        use:enhance={enhanceAction("marketplace")}
        aria-busy={pendingAction === "marketplace"}
      >
        <div class="field-group">
          <label class="field-label" for="marketplace-query">
            {$t("maintenance.marketplaceQuery")}
          </label>
          <input
            id="marketplace-query"
            class="field"
            name="query"
            bind:value={marketplaceQuery}
            minlength="3"
            maxlength="120"
            autocomplete="off"
            required
          />
        </div>
        <button
          class="button-primary min-h-11"
          disabled={pendingAction === "marketplace" ||
            marketplaceQuery.trim().length < 3}
          type="submit"
        >
          {$t("maintenance.marketplaceSearch")}
        </button>
      </form>

      {#if pendingAction === "marketplace"}
        <p class="text-sm text-[var(--muted)]" role="status" aria-live="polite">
          {$t("maintenance.marketplaceLoading")}
        </p>
      {:else if marketplaceState}
        {#if marketplaceState.mode === "external-search" && marketplaceState.fallbackUrl}
          <p
            class="text-sm text-[var(--muted)]"
            role="status"
            aria-live="polite"
          >
            {$t("maintenance.marketplaceExternalReady")}
          </p>
          <a
            class="button-primary min-h-11 justify-self-start"
            href={marketplaceState.fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {$t("maintenance.marketplaceOpenSearch")} ↗
          </a>
        {:else if marketplaceState.error}
          <p
            class="rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm"
            role={marketplaceState.error === "credentials-required"
              ? "status"
              : "alert"}
            aria-live="polite"
          >
            {marketplaceErrorLabel(marketplaceState.error)}
          </p>
        {:else if marketplaceState.offers.length === 0}
          <p
            class="text-sm text-[var(--muted)]"
            role="status"
            aria-live="polite"
          >
            {$t("maintenance.marketplaceNoResults")}
          </p>
        {:else}
          <p
            class="text-sm text-[var(--muted)]"
            role="status"
            aria-live="polite"
          >
            {$t("maintenance.marketplaceResultCount", {
              count: marketplaceState.offers.length,
            })}
          </p>
          <ul
            class="grid gap-3"
            aria-label={$t("maintenance.marketplaceHeading")}
          >
            {#each marketplaceState.offers as offer (offer.id)}
              <li class="rounded border border-[var(--line)] p-3">
                <h4 class="break-words font-semibold">{offer.title}</h4>
                <dl class="mt-2 grid gap-1 text-sm">
                  <div class="flex justify-between gap-3">
                    <dt class="text-[var(--muted)]">
                      {$t("maintenance.marketplacePrice")}
                    </dt>
                    <dd class="numeric font-semibold">
                      {formatMoney($locale, offer.priceCents, offer.currency)}
                    </dd>
                  </div>
                  <div class="flex justify-between gap-3">
                    <dt class="text-[var(--muted)]">
                      {$t("maintenance.marketplaceCondition")}
                    </dt>
                    <dd>{conditionLabel(offer.condition)}</dd>
                  </div>
                </dl>
                <a
                  class="mt-3 inline-block font-semibold text-[var(--fg)] underline underline-offset-4"
                  href={offer.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {$t("maintenance.marketplaceOpenOffer")} ↗
                </a>
              </li>
            {/each}
          </ul>
        {/if}
        {#if marketplaceState.mode !== "external-search" && marketplaceState.fallbackUrl}
          <a
            class="button-secondary min-h-11 justify-self-start"
            href={marketplaceState.fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {$t("maintenance.marketplaceOpenSearch")} ↗
          </a>
        {/if}
      {/if}
    </div>
  </RecordSheet>

  <!-- ALL PHOTOS RECORD SHEET -->
  <RecordSheet
    bind:this={photosSheet}
    title={$t("maintenance.photosHeading")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <div class="grid gap-6">
      <form
        class="grid gap-3"
        method="POST"
        action="?/uploadPhoto"
        enctype="multipart/form-data"
        use:enhance={enhanceAction("photo", () => $t("serviceUx.photoSaved"))}
        aria-busy={pendingAction === "photo"}
      >
        <h3 class="font-semibold">{$t("maintenance.photoFormTitle")}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="photo-record-all">
              {$t("maintenance.recordSelect")}
            </label>
            <select
              class="field"
              id="photo-record-all"
              name="maintenance_record_id"
              required
              disabled={!hasRecords}
            >
              <option value="">
                {hasRecords
                  ? $t("maintenance.recordSelect")
                  : $t("maintenance.noRecordsSelect")}
              </option>
              {#each data.rows as row (row.id)}
                <option value={String(row.id)}>
                  {String(row.date ?? "")} · {String(
                    row.maintenance_type ?? "",
                  )}
                </option>
              {/each}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="photo-caption-all">
              {$t("maintenance.caption")}
            </label>
            <input class="field" id="photo-caption-all" name="caption" />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="photo-file-all">
            {$t("maintenance.photoAlt")}
          </label>
          <input
            class="field"
            id="photo-file-all"
            name="photo"
            type="file"
            accept="image/*"
            required
          />
        </div>
        <button
          class="button-primary min-h-11 w-full"
          disabled={!hasRecords || pendingAction === "photo"}
          type="submit"
        >
          {$t("maintenance.sendPhoto")}
        </button>
        {#if !hasRecords}
          <p class="text-sm text-[var(--muted)]">
            {$t("maintenance.noRecordsHint")}
          </p>
        {/if}
      </form>

      <div class="grid gap-3 sm:grid-cols-2">
        {#each data.photos as photo (photo.id)}
          <article class="overflow-hidden rounded border border-[var(--line)]">
            <img
              class="aspect-video w-full object-cover"
              src={`/maintenance/photos/${photo.id}`}
              alt={String(photo.caption || $t("maintenance.photoAlt"))}
            />
            <div class="flex min-w-0 items-start justify-between gap-2 p-3">
              <div class="min-w-0 break-words">
                <p class="text-sm font-medium">
                  {photo.maintenance_records
                    ? `${photo.maintenance_records.date} · ${photo.maintenance_records.maintenance_type}`
                    : $t("maintenance.recordFallback")}
                </p>
                {#if photo.caption}
                  <p class="text-sm text-[var(--muted)]">{photo.caption}</p>
                {/if}
              </div>
              <form
                method="POST"
                action="?/deletePhoto"
                use:enhance={enhanceDelete(`delete-photo:${photo.id}`)}
                aria-busy={pendingAction === `delete-photo:${photo.id}`}
              >
                <input type="hidden" name="id" value={photo.id} />
                <button
                  class="button-danger min-h-11 px-3 py-1"
                  disabled={pendingAction === `delete-photo:${photo.id}`}
                  type="submit"
                  aria-label={`${$t("common.delete")} ${$t("maintenance.photoAlt")}`}
                  title={$t("common.delete")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </form>
            </div>
          </article>
        {:else}
          <p class="text-sm text-[var(--muted)] sm:col-span-2">
            {$t("maintenance.noPhotos")}
          </p>
        {/each}
      </div>
    </div>
  </RecordSheet>
</div>
