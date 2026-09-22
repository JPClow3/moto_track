<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
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
  import ActionMenu, {
    type ActionChoice,
  } from "$lib/components/app/ActionMenu.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import Download from "lucide-svelte/icons/download";
  import Package from "lucide-svelte/icons/package";
  import Search from "lucide-svelte/icons/search";
  import Camera from "lucide-svelte/icons/camera";
  import Trash2 from "lucide-svelte/icons/trash-2";

  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const km = (value: number) => Number(value).toLocaleString($locale);

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
    urgency?: "overdue" | "due_now" | "scheduled";
    due_km?: number | null;
    remaining_km?: number | null;
    progress_percent?: number | null;
    motorcycles?: { name: unknown } | null;
  };

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: hasRecords = data.rows.length > 0;
  $: plans = (data.plans ?? []) as PlanRow[];
  $: marketplaceState = form?.marketplace as MarketplaceState | undefined;

  let selectedMotorcycleId = data.motorcycles[0]?.id
    ? String(data.motorcycles[0].id)
    : "";
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
  };
  $: filteredRows = ((data.rows ?? []) as MaintenanceRecord[]).filter(
    (row: MaintenanceRecord) =>
      filterType === "all" || String(row.maintenance_type ?? "") === filterType,
  );

  let pendingAction = "";
  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";

  let actionMenu: ActionMenu;
  let logSheet: RecordSheet;
  let planSheet: RecordSheet;
  let partsSheet: RecordSheet;
  let marketplaceSheet: RecordSheet;
  let photosSheet: RecordSheet;
  let confirmDialog: ConfirmDialog;
  let marketplaceQuery = "";

  $: overdueCount = plans.filter((p) => p.urgency === "overdue").length;
  $: dueNowCount = plans.filter((p) => p.urgency === "due_now").length;
  $: totalSpent = data.rows.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum + Number(r.cost_cents ?? 0),
    0,
  );

  $: signals = [
    overdueCount > 0
      ? {
          label: $t("dashboard.urgencyOverdue"),
          value: `${overdueCount}`,
          hint: plans.find((p) => p.urgency === "overdue")?.maintenance_type
            ? String(
                plans.find((p) => p.urgency === "overdue")?.maintenance_type,
              )
            : undefined,
        }
      : dueNowCount > 0
        ? {
            label: $t("dashboard.urgencyNow"),
            value: `${dueNowCount}`,
            hint: plans.find((p) => p.urgency === "due_now")?.maintenance_type
              ? String(
                  plans.find((p) => p.urgency === "due_now")?.maintenance_type,
                )
              : undefined,
          }
        : plans[0]
          ? {
              label: $t("maintenance.dueNextTitle"),
              value: String(plans[0].maintenance_type ?? "—"),
              hint: plans[0].due_km
                ? `${km(Number(plans[0].due_km))} km`
                : undefined,
            }
          : {
              label: $t("maintenance.dueNextTitle"),
              value: "—",
              hint: $t("maintenance.noPlans"),
            },
    {
      label: $t("maintenance.recordsHeading"),
      value: `${data.rows.length}`,
      hint: $t("feature.recordCountOther", { count: data.rows.length }),
    },
    {
      label: $t("maintenance.costLabel"),
      value: brl(totalSpent),
      hint: $t("fuel.statsSpend"),
    },
  ] as Signal[];

  $: maintenanceChoices = [
    {
      id: "maintenance-log",
      label: $t("authenticatedUx.logCompleted"),
      description: $t("authenticatedUx.logCompletedDesc"),
      recommended: true,
    },
    {
      id: "maintenance-plan",
      label: $t("authenticatedUx.scheduleMaintenance"),
      description: $t("authenticatedUx.scheduleMaintenanceDesc"),
    },
  ] as ActionChoice[];

  function handleActionSelect(choiceId: string) {
    if (choiceId === "maintenance-log") {
      logSheet?.open();
    } else if (choiceId === "maintenance-plan") {
      planSheet?.open();
    }
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

  function urgencyColor(urgency: PlanRow["urgency"]) {
    if (urgency === "overdue") return "var(--danger)";
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

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown };
  }) => {
    if (result.type === "success") {
      statusRole = "status";
      statusMessage = $t("common.actionSuccess");
    } else {
      statusRole = "alert";
      statusMessage = String(result.data?.message ?? $t("error.serverBody"));
    }
  };

  const enhanceLogSubmit: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      if (result.type === "success") {
        logSheet?.close("success");
      }
      await update();
    };
  };

  const enhancePlanSubmit: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      if (result.type === "success") {
        planSheet?.close("success");
      }
      await update();
    };
  };

  function enhanceAction(action: string, onDone?: () => void): SubmitFunction {
    return () => {
      pendingAction = action;
      return async ({ result, update }) => {
        try {
          finishStatus(result);
          if (result.type === "success" && onDone) {
            onDone();
          }
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
      return async ({ result, update }) => {
        try {
          finishStatus(result);
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }
</script>

<div
  class="maintenance-page grid gap-6"
  aria-busy={formBusy || Boolean(pendingAction)}
>
  <PageHeader
    eyebrow={$t("nav.maintenance")}
    title={$t("maintenance.pageTitle")}
    description={$t("maintenance.pageSubtitle")}
  >
    <div slot="actions">
      <PageAction
        label={$t("authenticatedUx.addRecord")}
        ariaLabel={$t("authenticatedUx.addRecord")}
        on:click={() => actionMenu?.open()}
      />
    </div>

    <div slot="overflow">
      <PageOverflowMenu label={$t("authenticatedUx.moreActions")}>
        <a
          class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-[var(--fg)] transition hover:bg-[var(--panel-sunken)]"
          href="/maintenance/export.csv"
        >
          <Download size={16} aria-hidden="true" />
          <span>{$t("common.exportCsv")}</span>
        </a>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] transition hover:bg-[var(--panel-sunken)]"
          on:click={() => partsSheet?.open()}
        >
          <Package size={16} aria-hidden="true" />
          <span>{$t("maintenance.partsHeading")}</span>
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] transition hover:bg-[var(--panel-sunken)]"
          on:click={() => marketplaceSheet?.open()}
        >
          <Search size={16} aria-hidden="true" />
          <span>{$t("maintenance.marketplaceHeading")}</span>
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] transition hover:bg-[var(--panel-sunken)]"
          on:click={() => photosSheet?.open()}
        >
          <Camera size={16} aria-hidden="true" />
          <span>{$t("maintenance.photosHeading")}</span>
        </button>
      </PageOverflowMenu>
    </div>
  </PageHeader>

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
            class="field px-2 py-1 text-xs"
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

  <SignalStrip {signals} />

  {#if !hasMotorcycles}
    <div
      class="border-[var(--accent)]/30 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <span class="text-[var(--accent)]">
        {$t("maintenance.noMotorcyclesHint")}
      </span>
      <a class="button-secondary min-h-11 shrink-0" href="/garage">
        {$t("maintenance.goToGarage")}
      </a>
    </div>
  {/if}

  {#if form?.message || data.errorMessage}
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
    >
      {form?.message || data.errorMessage}
    </div>
  {/if}

  {#if statusMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "border-[var(--success)]/30 bg-[var(--success)]/10 rounded border p-3 text-sm text-[var(--success)]"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
    </p>
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

  <!-- UPCOMING / DUE MAINTENANCE PLANS (Lead with upcoming work first!) -->
  <section class="grid gap-3" aria-labelledby="maintenance-due-heading">
    <div class="flex items-center justify-between">
      <div>
        <h2 id="maintenance-due-heading" class="display text-2xl font-bold">
          {$t("maintenance.dueNextTitle")}
        </h2>
        <p class="text-sm text-[var(--muted)]">
          {$t("maintenance.dueNextHint")}
        </p>
      </div>
    </div>

    {#if plans.length === 0}
      <div class="panel border-dashed p-8 text-center">
        <p class="display text-2xl">{$t("maintenance.noPlans")}</p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          {$t("maintenance.dueNextHint")}
        </p>
        <button
          class="button-secondary mt-4 min-h-11"
          type="button"
          on:click={openPlanForm}
        >
          {$t("maintenance.openPlanForm")}
        </button>
      </div>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        {#each plans as plan (plan.id)}
          {@const urgency = plan.urgency ?? "scheduled"}
          <article class="panel grid gap-3 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <span
                  class="label-tech inline-block rounded border px-2 py-0.5 text-[10px]"
                  style={`color:${urgencyColor(urgency)};border-color:${urgencyColor(urgency)}55`}
                >
                  {urgencyLabel(urgency)}
                </span>
                <h3 class="display mt-1 truncate text-xl">
                  {String(plan.maintenance_type ?? "—")}
                </h3>
                <p class="text-sm text-[var(--muted)]">
                  {plan.motorcycles?.name ?? $t("maintenance.bikeFallback")}
                </p>
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
                  class="button-danger min-h-11 px-3 py-1 text-xs"
                  disabled={pendingAction === `delete-plan:${plan.id}`}
                  type="submit"
                >
                  {$t("common.delete")}
                </button>
              </form>
            </div>

            {#if plan.progress_percent !== null}
              <div>
                <div
                  class="flex items-center justify-between text-xs text-[var(--muted)]"
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
                  <span>{plan.progress_percent}%</span>
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
              <p class="text-sm text-[var(--muted)]">
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

            <div
              class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]"
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
                <span class="text-[var(--danger)]">
                  {$t("maintenance.historyNotDone")}
                </span>
              {:else if plan.initial_history_status === "unknown"}
                <span>{$t("maintenance.historyUnknown")}</span>
              {/if}
              {#if plan.official_url}
                <a
                  class="font-semibold text-brand underline-offset-4 hover:underline"
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
                class="button-secondary min-h-11 px-3 py-1 text-xs"
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
                  class="focus-ring flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                >
                  {$t("maintenance.editHistory")}
                </summary>
                <form
                  class="mt-2 grid gap-2"
                  method="POST"
                  action="?/updateHistory"
                  use:enhance={enhanceAction(`history:${plan.id}`)}
                  aria-busy={pendingAction === `history:${plan.id}`}
                >
                  <input type="hidden" name="plan_item_id" value={plan.id} />
                  <label class="grid gap-1">
                    {$t("maintenance.historyStatusLabel")}
                    <select
                      class="field"
                      name="initial_history_status"
                      value={String(plan.initial_history_status ?? "unknown")}
                    >
                      <option value="confirmed_done"
                        >{$t("history.confirmedDone")}</option
                      >
                      <option value="not_done">{$t("history.notDone")}</option>
                      <option value="unknown">{$t("history.unknown")}</option>
                    </select>
                  </label>
                  <label class="grid gap-1">
                    {$t("maintenance.lastDoneKmLabel")}
                    <input
                      class="field"
                      name="last_done_km"
                      type="number"
                      min="0"
                      value={plan.last_done_km ?? ""}
                    />
                  </label>
                  <p class="text-xs">{$t("maintenance.historyEditHint")}</p>
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
      class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h2 id="maintenance-history-heading" class="display text-2xl font-bold">
          {$t("maintenance.recordsHeading")}
        </h2>
        <p class="text-xs text-[var(--muted)]">
          {$t("feature.recordCountOther", { count: filteredRows.length })}
        </p>
      </div>
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
    </div>

    <ActivityTimeline
      title=""
      items={filteredRows}
      emptyMessage={$t("maintenance.emptyRecords")}
    >
      <div slot="empty" class="text-center">
        <p class="display text-2xl">{$t("maintenance.emptyRecords")}</p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          {$t("maintenance.emptyRecordsHint")}
        </p>
        <button
          class="button-primary mt-4"
          type="button"
          on:click={() => logSheet?.open()}
        >
          {$t("authenticatedUx.logCompleted")}
        </button>
      </div>

      <div slot="item" let:item>
        {@const row = item}
        {@const recordPhotos = data.photos.filter(
          (p) => String(p.maintenance_record_id) === String(row.id),
        )}
        <article class="panel grid gap-3 p-4">
          <div
            class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="label-tech text-xs text-[var(--muted)]">
                  {String(row.date ?? "")}
                </span>
                <span class="text-xs text-[var(--muted)]">·</span>
                <span class="text-xs font-semibold text-[var(--accent)]">
                  {String(row.motorcycle_name ?? "—")}
                </span>
                {#if row.odometer_km != null}
                  <span class="text-xs text-[var(--muted)]">·</span>
                  <span class="numeric text-xs text-[var(--muted)]">
                    {km(Number(row.odometer_km))} km
                  </span>
                {/if}
              </div>
              <h3 class="display mt-1 truncate text-xl">
                {String(row.maintenance_type ?? "—")}
              </h3>
              {#if row.workshop}
                <p class="text-sm text-[var(--muted)]">
                  {$t("maintenance.workshopLabel")}: {String(row.workshop)}
                </p>
              {/if}
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <span
                  class="display numeric text-lg font-bold text-[var(--fg)]"
                >
                  {brl(Number(row.cost_cents ?? 0))}
                </span>
              </div>
              <form
                method="POST"
                action="?/deleteRecord"
                use:enhance={enhanceDelete(`delete-record:${row.id}`)}
                aria-busy={pendingAction === `delete-record:${row.id}`}
              >
                <input type="hidden" name="_intent" value="delete" />
                <input type="hidden" name="id" value={String(row.id)} />
                <button
                  class="button-danger min-h-11 px-3 py-1 text-xs"
                  type="submit"
                  disabled={pendingAction === `delete-record:${row.id}`}
                  aria-label={`${$t("common.delete")} ${row.maintenance_type}`}
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
              class="focus-ring flex min-h-11 cursor-pointer items-center justify-between text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <span
                >{$t("feature.editRecord")} & {$t("maintenance.photosHeading")} ({recordPhotos.length})</span
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
                        class="flex items-center justify-between p-2 text-xs"
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
                            class="button-danger px-2 py-1 text-xs"
                            disabled={pendingAction ===
                              `delete-photo:${photo.id}`}
                            type="submit"
                          >
                            {$t("common.delete")}
                          </button>
                        </form>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Upload photo form for this record -->
              <form
                class="grid gap-2 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3"
                method="POST"
                action="?/uploadPhoto"
                enctype="multipart/form-data"
                use:enhance={enhanceAction(`photo:${row.id}`)}
                aria-busy={pendingAction === `photo:${row.id}`}
              >
                <input
                  type="hidden"
                  name="maintenance_record_id"
                  value={String(row.id)}
                />
                <p class="text-xs font-semibold">
                  {$t("maintenance.photoFormTitle")}
                </p>
                <div class="grid gap-2 sm:grid-cols-2">
                  <input
                    class="field text-xs"
                    name="caption"
                    placeholder={$t("maintenance.caption")}
                  />
                  <input
                    class="field text-xs"
                    name="photo"
                    type="file"
                    accept="image/*"
                    required
                  />
                </div>
                <button
                  class="button-secondary min-h-9 justify-self-start text-xs"
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
                use:enhance={enhanceAction(`edit-record:${row.id}`)}
                aria-busy={pendingAction === `edit-record:${row.id}`}
              >
                <input type="hidden" name="_intent" value="update" />
                <input type="hidden" name="id" value={String(row.id)} />
                <div class="field-group">
                  <label class="field-label" for={`edit-${row.id}-motorcycle`}>
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
                  <label class="field-label" for={`edit-${row.id}-odometer`}>
                    {$t("maintenance.recordOdometerLabel")}
                  </label>
                  <input
                    class="field"
                    id={`edit-${row.id}-odometer`}
                    type="number"
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
                  <label class="field-label" for={`edit-${row.id}-workshop`}>
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
                    type="number"
                    step="0.01"
                    name="cost_cents"
                    value={Number(row.cost_cents ?? 0) / 100}
                  />
                </div>
                <div class="field-group md:col-span-3">
                  <label class="field-label" for={`edit-${row.id}-description`}>
                    {$t("maintenance.descriptionLabel")}
                  </label>
                  <textarea
                    class="field min-h-16"
                    id={`edit-${row.id}-description`}
                    name="description">{String(row.description ?? "")}</textarea
                  >
                </div>
                <div class="flex items-end md:col-span-3">
                  <button
                    class="button-primary"
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
  </section>

  <!-- ACTION MENU DIALOG -->
  <ActionMenu
    bind:this={actionMenu}
    title={$t("maintenance.pageTitle")}
    choices={maintenanceChoices}
    closeLabel={$t("authenticatedUx.close")}
    on:select={(e) => handleActionSelect(e.detail)}
  />

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
            type="number"
            step="0.01"
            min="0"
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
          placeholder={$t("maintenance.maintenanceType")}
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
            min="1"
          />
        </div>
      </div>

      <button
        class="button-primary min-h-11 w-full"
        disabled={!hasMotorcycles || formBusy}
        type="submit"
      >
        {$t("maintenance.savePlan")}
      </button>
      {#if !hasMotorcycles}
        <p class="text-xs text-[var(--muted)]">
          {$t("maintenance.noMotorcyclesHint")}
        </p>
      {/if}
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
        use:enhance={enhanceAction("part")}
        aria-busy={pendingAction === "part"}
      >
        <h3 class="font-bold">{$t("maintenance.partsFormTitle")}</h3>
        <input
          class="field"
          name="name"
          aria-label={$t("maintenance.partName")}
          placeholder={$t("maintenance.partName")}
          required
        />
        <input
          class="field"
          name="manufacturer"
          aria-label={$t("maintenance.manufacturer")}
          placeholder={$t("maintenance.manufacturer")}
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="part-price">
              {$t("maintenance.price")}
            </label>
            <input
              class="field"
              id="part-price"
              name="price"
              type="number"
              step=".01"
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
              value="0"
              min="0"
            />
          </div>
        </div>
        <label class="flex min-h-11 items-center gap-2">
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
        <h3 class="font-bold">{$t("maintenance.partsListHeading")}</h3>
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
                class="button-secondary min-h-9 px-2 py-1 text-xs"
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
                  class="button-danger min-h-9 px-2 py-1 text-xs"
                  disabled={pendingAction === `delete-part:${part.id}`}
                  type="submit"
                >
                  {$t("common.delete")}
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
        <label class="grid gap-1 text-sm" for="marketplace-query">
          {$t("maintenance.marketplaceQuery")}
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
        </label>
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
            class="rounded border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-sm"
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
                    <dd class="font-semibold">
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
                  class="mt-3 inline-block font-semibold text-brand underline-offset-4 hover:underline"
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
        use:enhance={enhanceAction("photo")}
        aria-busy={pendingAction === "photo"}
      >
        <h3 class="font-bold">{$t("maintenance.photoFormTitle")}</h3>
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
        <input
          class="field"
          name="photo"
          aria-label={$t("maintenance.photoFormTitle")}
          type="file"
          accept="image/*"
          required
        />
        <button
          class="button-primary min-h-11 w-full"
          disabled={!hasRecords || pendingAction === "photo"}
          type="submit"
        >
          {$t("maintenance.sendPhoto")}
        </button>
        {#if !hasRecords}
          <p class="text-xs text-[var(--muted)]">
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
                  class="button-danger min-h-9 px-2 py-1 text-xs"
                  disabled={pendingAction === `delete-photo:${photo.id}`}
                  type="submit"
                >
                  {$t("common.delete")}
                </button>
              </form>
            </div>
          </article>
        {:else}
          <p class="text-sm text-[var(--muted)]">
            {$t("maintenance.noPhotos")}
          </p>
        {/each}
      </div>
    </div>
  </RecordSheet>
</div>
