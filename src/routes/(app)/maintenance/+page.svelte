<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
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
  $: filteredRows = data.rows.filter(
    (row: Record<string, unknown>) =>
      filterType === "all" || String(row.maintenance_type ?? "") === filterType,
  );

  let pendingAction = "";
  let confirmDialog: ConfirmDialog;
  let marketplaceQuery = "";

  function seedMarketplaceQuery(value: string) {
    marketplaceQuery = value.trim().slice(0, 120);
    if (typeof document !== "undefined") {
      document.getElementById("marketplace-query")?.focus();
      document.getElementById("marketplace-details")?.setAttribute("open", "");
    }
  }

  // The plan form lives in a collapsed panel far down the rail; the empty
  // state opens and reveals it instead of pointing at it with an arrow.
  function openPlanForm() {
    if (typeof document === "undefined") return;
    const details = document.getElementById("new-plan-details");
    details?.setAttribute("open", "");
    details?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  function enhanceAction(action: string): SubmitFunction {
    return () => {
      pendingAction = action;
      return async ({ update }) => {
        try {
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
      return async ({ update }) => {
        try {
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }
</script>

<svelte:head
  ><title>{$t("maintenance.pageTitle")} · Moto Track</title></svelte:head
>
<section class="grid gap-6">
  <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>{$t(
          "nav.maintenance",
        )}
      </p>
      <h1 class="display text-4xl">{$t("maintenance.pageTitle")}</h1>
      <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        {$t("maintenance.pageSubtitle")}
      </p>
    </div>
    <a class="button-secondary" href="/maintenance/export.csv"
      >{$t("common.exportCsv")}</a
    >
  </div>

  {#if !hasMotorcycles}
    <div
      class="border-[var(--accent)]/30 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <span class="text-[var(--accent)]"
        >{$t("maintenance.noMotorcyclesHint")}</span
      >
      <a class="button-secondary min-h-11 shrink-0" href="/garage"
        >{$t("maintenance.goToGarage")}</a
      >
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
  {#if form?.ok}
    <p
      class="border-[var(--success)]/30 bg-[var(--success)]/10 rounded border p-3 text-sm text-[var(--success)]"
      role="status"
      aria-live="polite"
    >
      {$t("common.actionSuccess")}
    </p>
  {/if}
  <ConfirmDialog
    bind:this={confirmDialog}
    confirmLabel={$t("common.delete")}
    destructive
  />

  <!-- Free-text typing here produced "Troca de oleo" vs "troca de óleo" soup;
       the datalist suggests canonical names while still allowing any value. -->
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

  <div class="grid gap-3">
    <div>
      <h2 class="display text-2xl">{$t("maintenance.dueNextTitle")}</h2>
      <p class="text-sm text-[var(--muted)]">{$t("maintenance.dueNextHint")}</p>
    </div>
    {#if plans.length === 0}
      <div
        class="rounded border border-dashed border-[var(--line)] p-8 text-center"
      >
        <p class="display text-2xl">{$t("maintenance.noPlans")}</p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          {$t("maintenance.dueNextHint")}
        </p>
        <button
          class="button-secondary mt-4 min-h-11"
          type="button"
          on:click={openPlanForm}>{$t("maintenance.openPlanForm")}</button
        >
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
                  >{urgencyLabel(urgency)}</span
                >
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
                <input type="hidden" name="id" value={String(plan.id)} /><button
                  class="button-danger min-h-11 px-3 py-1 text-xs"
                  disabled={pendingAction === `delete-plan:${plan.id}`}
                  type="submit">{$t("common.delete")}</button
                >
              </form>
            </div>

            {#if plan.progress_percent !== null}
              <div>
                <div
                  class="flex items-center justify-between text-xs text-[var(--muted)]"
                >
                  <span
                    >{$t("maintenance.progressKm", {
                      done: km(
                        Math.max(
                          Number(plan.current_km ?? 0) -
                            Number(plan.last_done_km ?? 0),
                          0,
                        ),
                      ),
                      total: km(Number(plan.interval_km)),
                    })}</span
                  >
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
                <span
                  >{$t("dashboard.estimate")}:
                  {brl(Number(plan.estimated_cost_cents))}</span
                >
              {/if}
              {#if plan.remaining_km != null && Number(plan.remaining_km) > 0}
                <span
                  >{$t("maintenance.remainingKm", {
                    count: km(Number(plan.remaining_km)),
                  })}</span
                >
              {/if}
              {#if plan.initial_history_status === "not_done"}
                <span class="text-[var(--danger)]"
                  >{$t("maintenance.historyNotDone")}</span
                >
              {:else if plan.initial_history_status === "unknown"}
                <span>{$t("maintenance.historyUnknown")}</span>
              {/if}
              {#if plan.official_url}
                <a
                  class="font-semibold text-brand underline-offset-4 hover:underline"
                  href={String(plan.official_url)}
                  target="_blank"
                  rel="noreferrer">{$t("dashboard.officialManual")} ↗</a
                >
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
                  >{$t("maintenance.editHistory")}</summary
                >
                <form
                  class="mt-2 grid gap-2"
                  method="POST"
                  action="?/updateHistory"
                  use:enhance={enhanceAction(`history:${plan.id}`)}
                  aria-busy={pendingAction === `history:${plan.id}`}
                >
                  <input type="hidden" name="plan_item_id" value={plan.id} />
                  <label class="grid gap-1"
                    >{$t("maintenance.historyStatusLabel")}<select
                      class="field"
                      name="initial_history_status"
                      value={String(plan.initial_history_status ?? "unknown")}
                    >
                      <option value="confirmed_done"
                        >{$t("history.confirmedDone")}</option
                      >
                      <option value="not_done">{$t("history.notDone")}</option>
                      <option value="unknown">{$t("history.unknown")}</option>
                    </select></label
                  >
                  <label class="grid gap-1"
                    >{$t("maintenance.lastDoneKmLabel")}<input
                      class="field"
                      name="last_done_km"
                      type="number"
                      min="0"
                      value={plan.last_done_km ?? ""}
                    /></label
                  >
                  <p class="text-xs">{$t("maintenance.historyEditHint")}</p>
                  <button
                    class="button-secondary min-h-11 justify-self-start"
                    disabled={pendingAction === `history:${plan.id}`}
                    type="submit">{$t("maintenance.saveHistory")}</button
                  >
                </form>
              </details>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <div class="panel overflow-hidden">
      <div
        class="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <h2 class="display text-xl">{$t("maintenance.recordsHeading")}</h2>
        <div class="field-group min-w-0 sm:max-w-xs">
          <label class="field-label" for="maintenance-filter-type"
            >{$t("maintenance.maintenanceType")}</label
          >
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
      <p class="px-4 pb-2 text-xs text-[var(--muted)]" role="status">
        {$t("feature.recordCountOther", { count: filteredRows.length })}
      </p>
      <div class="maintenance-table-scroll overflow-x-auto">
        <table class="maintenance-table w-full text-left text-sm">
          <thead
            class="border-b border-t border-[var(--line)] text-xs uppercase text-[var(--muted)]"
          >
            <tr>
              <th class="px-4 py-3">{$t("maintenance.recordDateLabel")}</th>
              <th>{$t("maintenance.bikeFallback")}</th>
              <th>{$t("maintenance.maintenanceType")}</th>
              <th>{$t("maintenance.recordOdometerLabel")}</th>
              <th>{$t("maintenance.costLabel")}</th>
              <th>{$t("maintenance.workshopLabel")}</th>
              <th>{$t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredRows as row (row.id)}
              <tr class="border-b border-[var(--line)]">
                <td
                  class="px-4 py-3"
                  data-label={$t("maintenance.recordDateLabel")}
                  >{String(row.date ?? "")}</td
                >
                <td data-label={$t("maintenance.bikeFallback")}
                  >{String(row.motorcycle_name ?? "—")}</td
                >
                <td data-label={$t("maintenance.maintenanceType")}
                  >{String(row.maintenance_type ?? "—")}</td
                >
                <td data-label={$t("maintenance.recordOdometerLabel")}
                  >{row.odometer_km == null
                    ? "—"
                    : `${km(Number(row.odometer_km))} km`}</td
                >
                <td data-label={$t("maintenance.costLabel")}
                  >{brl(Number(row.cost_cents ?? 0))}</td
                >
                <td data-label={$t("maintenance.workshopLabel")}
                  >{String(row.workshop ?? "") || "—"}</td
                >
                <td
                  class="maintenance-actions"
                  data-label={$t("common.actions")}
                >
                  <form
                    method="POST"
                    use:enhance={enhanceDelete(`delete-record:${row.id}`)}
                    aria-busy={pendingAction === `delete-record:${row.id}`}
                  >
                    <input type="hidden" name="_intent" value="delete" />
                    <input type="hidden" name="id" value={String(row.id)} />
                    <button
                      class="button-danger min-h-11 px-3 py-1 text-xs"
                      type="submit"
                      disabled={pendingAction === `delete-record:${row.id}`}
                      >{$t("common.delete")}</button
                    >
                  </form>
                </td>
              </tr>
              <tr class="border-b border-[var(--line)]">
                <td colspan="7" class="px-4 pb-3">
                  <details>
                    <summary
                      class="focus-ring flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                      >{$t("feature.editRecord")}</summary
                    >
                    <form
                      class="mt-2 grid gap-3 md:grid-cols-3"
                      method="POST"
                      use:enhance={enhanceAction(`edit-record:${row.id}`)}
                      aria-busy={pendingAction === `edit-record:${row.id}`}
                    >
                      <input type="hidden" name="_intent" value="update" />
                      <input type="hidden" name="id" value={String(row.id)} />
                      <div class="field-group">
                        <label
                          class="field-label"
                          for={`edit-${row.id}-motorcycle`}
                          >{$t("maintenance.bikeFallback")}</label
                        >
                        <select
                          class="field"
                          id={`edit-${row.id}-motorcycle`}
                          name="motorcycle_id"
                          required
                        >
                          <option value="">
                            {$t("common.select")}
                          </option>
                          {#each data.motorcycles as moto (moto.id)}
                            <option
                              value={moto.id}
                              selected={String(row.motorcycle_id ?? "") ===
                                moto.id}>{moto.name}</option
                            >
                          {/each}
                        </select>
                      </div>
                      <div class="field-group">
                        <label class="field-label" for={`edit-${row.id}-date`}
                          >{$t("maintenance.recordDateLabel")}</label
                        >
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
                          >{$t("maintenance.recordOdometerLabel")}</label
                        >
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
                        <label class="field-label" for={`edit-${row.id}-type`}
                          >{$t("maintenance.maintenanceType")}</label
                        >
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
                          >{$t("maintenance.workshopLabel")}</label
                        >
                        <input
                          class="field"
                          id={`edit-${row.id}-workshop`}
                          name="workshop"
                          value={String(row.workshop ?? "")}
                        />
                      </div>
                      <div class="field-group">
                        <label class="field-label" for={`edit-${row.id}-cost`}
                          >{$t("maintenance.costLabel")}</label
                        >
                        <input
                          class="field"
                          id={`edit-${row.id}-cost`}
                          type="number"
                          step="0.01"
                          name="cost_cents"
                          value={Number(row.cost_cents ?? 0) / 100}
                        />
                      </div>
                      <div class="field-group md:col-span-2">
                        <label
                          class="field-label"
                          for={`edit-${row.id}-description`}
                          >{$t("maintenance.descriptionLabel")}</label
                        >
                        <textarea
                          class="field min-h-16"
                          id={`edit-${row.id}-description`}
                          name="description"
                          >{String(row.description ?? "")}</textarea
                        >
                      </div>
                      <div class="flex items-end gap-3">
                        <div class="field-group">
                          <label
                            class="field-label"
                            for={`edit-${row.id}-interval-km`}
                            >{$t("maintenance.intervalKm")}</label
                          >
                          <input
                            class="field"
                            id={`edit-${row.id}-interval-km`}
                            type="number"
                            name="interval_km"
                            value={String(row.interval_km ?? "")}
                          />
                        </div>
                        <div class="field-group">
                          <label
                            class="field-label"
                            for={`edit-${row.id}-interval-days`}
                            >{$t("maintenance.intervalDays")}</label
                          >
                          <input
                            class="field"
                            id={`edit-${row.id}-interval-days`}
                            type="number"
                            name="interval_days"
                            value={String(row.interval_days ?? "")}
                          />
                        </div>
                      </div>
                      <div class="flex items-end">
                        <button
                          class="button-primary"
                          type="submit"
                          disabled={pendingAction === `edit-record:${row.id}`}
                          >{$t("common.saveChanges")}</button
                        >
                      </div>
                    </form>
                  </details>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="7" class="px-4 py-12 text-center">
                  <p class="display text-2xl">
                    {$t("maintenance.emptyRecords")}
                  </p>
                  <p class="mt-2 text-sm text-[var(--muted)]">
                    {$t("maintenance.emptyRecordsHint")}
                  </p>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid h-fit gap-4">
      <form
        class="panel relative grid gap-3 overflow-hidden p-5"
        method="POST"
        use:enhance={enhanceAction("create-record")}
        aria-busy={pendingAction === "create-record"}
      >
        <div class="corner-slashes" aria-hidden="true"></div>
        <input type="hidden" name="_intent" value="create" />
        <h2 class="display relative text-xl">
          {$t("maintenance.recordFormTitle")}
        </h2>
        <div class="relative grid gap-3">
          <label class="field-label" for="record-motorcycle"
            >{$t("maintenance.bikeFallback")}</label
          >
          <select
            class="field"
            id="record-motorcycle"
            name="motorcycle_id"
            required
            disabled={!hasMotorcycles}
          >
            {#each data.motorcycles as moto (moto.id)}
              <option value={moto.id}>{moto.name}</option>
            {/each}
          </select>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="record-date"
                >{$t("maintenance.recordDateLabel")}</label
              >
              <input
                class="field"
                id="record-date"
                type="date"
                name="date"
                required
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="record-odometer"
                >{$t("maintenance.recordOdometerLabel")}</label
              >
              <input
                class="field"
                id="record-odometer"
                type="number"
                name="odometer_km"
                required
              />
            </div>
          </div>
          <label class="field-label" for="record-type"
            >{$t("maintenance.maintenanceType")}</label
          >
          <input
            class="field"
            id="record-type"
            name="maintenance_type"
            required
            list="maintenance-type-suggestions"
          />
          <label class="field-label" for="record-description"
            >{$t("maintenance.descriptionLabel")}</label
          >
          <textarea
            class="field min-h-16"
            id="record-description"
            name="description"
          ></textarea>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="record-workshop"
                >{$t("maintenance.workshopLabel")}</label
              >
              <input class="field" id="record-workshop" name="workshop" />
            </div>
            <div class="field-group">
              <label class="field-label" for="record-cost"
                >{$t("maintenance.costLabel")}</label
              >
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
              <label class="field-label" for="record-interval-km"
                >{$t("maintenance.intervalKm")}</label
              >
              <input
                class="field"
                id="record-interval-km"
                type="number"
                min="0"
                name="interval_km"
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="record-interval-days"
                >{$t("maintenance.intervalDays")}</label
              >
              <input
                class="field"
                id="record-interval-days"
                type="number"
                min="0"
                name="interval_days"
              />
            </div>
          </div>
        </div>
        <button
          class="button-primary relative"
          type="submit"
          disabled={!hasMotorcycles || pendingAction === "create-record"}
          >{$t("common.save")}</button
        >
      </form>

      <details id="new-plan-details" class="panel p-5">
        <summary class="display cursor-pointer text-lg">
          {$t("maintenance.planFormTitle")}
        </summary>
        <form
          class="mt-3 grid gap-3"
          method="POST"
          action="?/savePlan"
          use:enhance={enhanceAction("plan")}
          aria-busy={pendingAction === "plan"}
        >
          <select
            class="field"
            name="motorcycle_id"
            aria-label={$t("maintenance.bikeFallback")}
            disabled={!hasMotorcycles}
            required
            ><option value=""
              >{hasMotorcycles
                ? $t("common.select")
                : $t("maintenance.noMotorcyclesSelect")}</option
            >{#each data.motorcycles as m (m.id)}<option value={m.id}
                >{m.name}</option
              >{/each}</select
          ><input
            class="field"
            name="maintenance_type"
            aria-label={$t("maintenance.maintenanceType")}
            placeholder={$t("maintenance.maintenanceType")}
            required
            list="maintenance-type-suggestions"
          />
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="plan-interval-km"
                >{$t("maintenance.intervalKm")}</label
              >
              <input
                class="field"
                id="plan-interval-km"
                name="interval_km"
                type="number"
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="plan-interval-days"
                >{$t("maintenance.intervalDays")}</label
              >
              <input
                class="field"
                id="plan-interval-days"
                name="interval_days"
                type="number"
              />
            </div>
          </div>
          <button
            class="button-secondary justify-self-start"
            disabled={!hasMotorcycles || pendingAction === "plan"}
            type="submit">{$t("maintenance.savePlan")}</button
          >
          {#if !hasMotorcycles}<p class="text-xs text-[var(--muted)]">
              {$t("maintenance.noMotorcyclesHint")}
            </p>{/if}
        </form>
      </details>
    </div>
  </div>

  <details id="marketplace-details" class="panel p-5">
    <summary class="display cursor-pointer text-xl">
      {$t("maintenance.partsHeading")}
      <span class="block text-sm font-normal text-[var(--muted)]"
        >{$t("maintenance.marketplaceHint")}</span
      >
    </summary>
    <div class="mt-5 grid gap-6 lg:grid-cols-2">
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
        /><input
          class="field"
          name="manufacturer"
          aria-label={$t("maintenance.manufacturer")}
          placeholder={$t("maintenance.manufacturer")}
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="part-price"
              >{$t("maintenance.price")}</label
            >
            <input
              class="field"
              id="part-price"
              name="price"
              type="number"
              step=".01"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="part-stock"
              >{$t("maintenance.stockQuantity")}</label
            >
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
        <label class="flex min-h-11 items-center gap-2"
          ><input name="track_stock" type="checkbox" value="true" />
          {$t("maintenance.trackStock")}</label
        ><button
          class="button-secondary justify-self-start"
          disabled={pendingAction === "part"}
          type="submit">{$t("maintenance.savePart")}</button
        >
      </form>

      <section class="grid gap-3" aria-labelledby="marketplace-heading">
        <div class="grid gap-1">
          <h3 id="marketplace-heading" class="font-bold">
            {$t("maintenance.marketplaceHeading")}
          </h3>
        </div>
        <form
          class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          method="POST"
          action="?/searchMarketplace"
          use:enhance={enhanceAction("marketplace")}
          aria-busy={pendingAction === "marketplace"}
        >
          <label class="grid gap-1 text-sm" for="marketplace-query"
            >{$t("maintenance.marketplaceQuery")}
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
            class="button-secondary min-h-11"
            disabled={pendingAction === "marketplace" ||
              marketplaceQuery.trim().length < 3}
            type="submit"
          >
            {$t("maintenance.marketplaceSearch")}
          </button>
        </form>
        {#if pendingAction === "marketplace"}
          <p
            class="text-sm text-[var(--muted)]"
            role="status"
            aria-live="polite"
          >
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
              class="grid gap-3 sm:grid-cols-2"
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
      </section>
    </div>

    <div class="mt-6 grid gap-2">
      <h3 class="font-bold">{$t("maintenance.partsListHeading")}</h3>
      {#each data.parts as part (part.id)}
        <article
          class="flex min-w-0 flex-col justify-between gap-3 rounded border border-[var(--line)] p-3 sm:flex-row sm:items-start"
        >
          <span class="min-w-0 break-words"
            >{part.name}
            {part.manufacturer ? `· ${part.manufacturer}` : ""} · {brl(
              Number(part.price_cents ?? 0),
            )}
            {part.track_stock
              ? `· ${$t("maintenance.stockSuffix")} ${part.stock_quantity}`
              : ""}</span
          >
          <div class="flex shrink-0 gap-2">
            <button
              class="button-secondary min-h-11"
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
              <input type="hidden" name="id" value={part.id} /><button
                class="button-danger min-h-11"
                disabled={pendingAction === `delete-part:${part.id}`}
                type="submit">{$t("common.delete")}</button
              >
            </form>
          </div>
        </article>
      {:else}
        <p class="text-sm text-[var(--muted)]">{$t("maintenance.noParts")}</p>
      {/each}
    </div>
  </details>

  <details class="panel p-5">
    <summary class="display cursor-pointer text-xl">
      {$t("maintenance.photosHeading")}
    </summary>
    <div class="mt-5 grid gap-6">
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
            <label class="field-label" for="photo-record"
              >{$t("maintenance.recordSelect")}</label
            >
            <select
              class="field"
              id="photo-record"
              name="maintenance_record_id"
              required
              disabled={!hasRecords}
            >
              <option value=""
                >{hasRecords
                  ? $t("maintenance.recordSelect")
                  : $t("maintenance.noRecordsSelect")}</option
              >
              {#each data.rows as row (row.id)}
                <option value={String(row.id)}
                  >{String(row.date ?? "")} · {String(
                    row.maintenance_type ?? "",
                  )}</option
                >
              {/each}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="photo-caption"
              >{$t("maintenance.caption")}</label
            >
            <input class="field" id="photo-caption" name="caption" />
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
          class="button-secondary justify-self-start"
          disabled={!hasRecords || pendingAction === "photo"}
          type="submit">{$t("maintenance.sendPhoto")}</button
        >
        {#if !hasRecords}<p class="text-xs text-[var(--muted)]">
            {$t("maintenance.noRecordsHint")}
          </p>{/if}
      </form>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <input type="hidden" name="id" value={photo.id} /><button
                  class="button-danger min-h-11 px-3 py-1 text-xs"
                  disabled={pendingAction === `delete-photo:${photo.id}`}
                  type="submit">{$t("common.delete")}</button
                >
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
  </details>
</section>

<style>
  @media (max-width: 1279px) {
    .maintenance-table-scroll {
      overflow-x: visible;
    }

    .maintenance-table {
      min-width: 0;
      border-collapse: separate;
      border-spacing: 0 0.75rem;
    }

    .maintenance-table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .maintenance-table tbody tr {
      display: block;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--panel);
    }

    .maintenance-table tbody tr td {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
      padding: 0.75rem 1rem;
    }

    .maintenance-table tbody tr td::before {
      flex: 0 0 36%;
      min-width: 0;
      color: var(--muted);
      content: attr(data-label);
      font-family: "Barlow Condensed", Barlow, ui-sans-serif, sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .maintenance-table tbody tr td > * {
      min-width: 0;
      max-width: 64%;
      overflow-wrap: anywhere;
    }

    .maintenance-table tbody tr td.maintenance-actions {
      display: block;
    }

    .maintenance-table tbody tr td.maintenance-actions::before {
      display: block;
      margin-bottom: 0.65rem;
    }
  }

  @media (min-width: 1280px) {
    .maintenance-table {
      min-width: 820px;
    }
  }
</style>
