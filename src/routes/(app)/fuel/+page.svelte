<script lang="ts">
  import { actionMessage } from "$lib/i18n/action-messages";
  import { enhance } from "$app/forms";
  import { afterNavigate, replaceState } from "$app/navigation";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney, formatPreciseMoney } from "$lib/i18n";
  import {
    queueOfflineFuelSubmission,
    requestOfflineFuelSync,
  } from "$lib/utils/offline-fuel";
  import { privateFileUrl } from "$lib/utils/private-file-url";
  import { dateOnlyValue } from "$lib/utils/feature-values";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import NearbyStations from "$components/NearbyStations.svelte";
  import LocationFields from "$components/LocationFields.svelte";
  import FuelRecordFields, {
    type FuelFieldValues,
  } from "$components/FuelRecordFields.svelte";
  import TrendChart from "$components/charts/TrendChart.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import SignalStrip, {
    type Signal,
  } from "$lib/components/app/SignalStrip.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import PageOverflowMenu from "$lib/components/app/PageOverflowMenu.svelte";
  import ActivityTimeline from "$lib/components/app/ActivityTimeline.svelte";
  import Camera from "lucide-svelte/icons/camera";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import CloudOff from "lucide-svelte/icons/cloud-off";
  import Download from "lucide-svelte/icons/download";
  import Upload from "lucide-svelte/icons/upload";
  import SlidersHorizontal from "lucide-svelte/icons/sliders-horizontal";
  import Fuel from "lucide-svelte/icons/fuel";
  import RotateCcw from "lucide-svelte/icons/rotate-ccw";

  export let data;
  export let form;

  type Row = Record<string, unknown>;

  const brl = (cents: number) => formatMoney($locale, cents);
  const price = (millicents: number) => formatPreciseMoney($locale, millicents);

  // Decimal fields are text inputs (pt-BR riders type "4,59"); the server
  // parses both marks. Accepts "4,59", "4.59", "1.234,56" and "1,234.56".
  const DECIMAL_PATTERN = "[0-9]+([.,][0-9]{3})*([.,][0-9]+)?";

  /** Prefill a decimal field in the rider's own notation, without grouping. */
  const decimalInput = (
    value: unknown,
    maximumFractionDigits: number,
    minimumFractionDigits = 0,
  ) => {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return new Intl.NumberFormat($locale, {
      useGrouping: false,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(number);
  };

  $: defaults = data.preferences[0] ?? {};
  $: hasRecords = data.rows.length > 0;
  // The shell's bike switcher is the only bike context; the server already
  // scoped the rows to it, so the latest row is this bike's last fill-up.
  $: activeMotorcycleId = String(
    data.activeMotorcycleId ?? data.motorcycles[0]?.id ?? "",
  );
  $: activeMotorcycle = data.motorcycles.find(
    (moto: Row) => String(moto.id) === activeMotorcycleId,
  ) as Row | undefined;
  $: lastRecord = data.rows[0] as Row | undefined;
  $: latestOdometer =
    lastRecord?.odometer_km ?? activeMotorcycle?.current_odometer_km ?? null;

  $: stationNameById = new Map<string, string>(
    data.stations.map((station: Row) => [
      String(station.id),
      String(station.name ?? ""),
    ]),
  );
  /** Records saved against a saved station used to leave the name blank. */
  const stationLabel = (row: Row) =>
    String(
      row.station_name || stationNameById.get(String(row.station_id)) || "",
    );

  // History filters: a visible chip row, not a menu item.
  let filterStation = "";
  let filterPeriod = "all";
  $: hasActiveFilters = Boolean(filterStation) || filterPeriod !== "all";
  $: stationOptions = [
    ...new Set<string>(
      data.rows.map((row: Row) => stationLabel(row)).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  // A station picked on another bike may not exist here (and the picker hides
  // below two stations), so drop it instead of leaving an empty list.
  $: if (filterStation && !stationOptions.includes(filterStation))
    filterStation = "";
  $: periodChips = [
    { id: "90d", label: $t("fuel.period90d") },
    { id: "12m", label: $t("fuel.period12m") },
    { id: "all", label: $t("fuel.periodAll") },
  ];

  const PERIOD_DAYS: Record<string, number> = { "90d": 90, "12m": 365 };
  $: periodCutoff = PERIOD_DAYS[filterPeriod]
    ? new Date(Date.now() - PERIOD_DAYS[filterPeriod] * 86400000)
        .toISOString()
        .slice(0, 10)
    : null;

  $: filteredRows = data.rows.filter((row: Row) => {
    if (filterStation && stationLabel(row) !== filterStation) return false;
    if (periodCutoff && String(row.date ?? "") < periodCutoff) return false;
    return true;
  });

  function clearFilters() {
    filterStation = "";
    filterPeriod = "all";
  }

  // Status & dialog state. Successes go to a toast; only failures stay inline.
  let formBusy = false;
  let errorMessage = "";
  let confirmDialog: ConfirmDialog;

  $: visibleError = errorMessage || data.errorMessage || form?.message || "";

  // Sheet dialog refs
  let newSheet: RecordSheet;
  let scanSheet: RecordSheet;
  let editSheet: RecordSheet;
  let importSheet: RecordSheet;
  let preferencesSheet: RecordSheet;

  // Every "add fuel" entry point opens this one form. Scanning a receipt and
  // repeating the last fill-up only prefill it.
  let newValues: FuelFieldValues = {};
  let newFormKey = 0;
  $: savedDefaults = {
    motorcycle_id: activeMotorcycleId,
    station_name:
      String(defaults.station_name ?? "") ||
      stationNameById.get(String(defaults.station_id)) ||
      "",
    fuel_grade_id: String(defaults.fuel_grade_id ?? ""),
    fuel_type: String(defaults.fuel_type ?? "gasoline"),
    tank_full: (defaults.tank_full as boolean | undefined) ?? true,
  } satisfies FuelFieldValues;

  // Defaults form: one station field and one fuel choice, as in the fill-up.
  let defaultsStationName = "";
  let defaultsFuel = "type:gasoline";
  let defaultsSeeded = false;
  $: if (!defaultsSeeded) {
    defaultsSeeded = true;
    defaultsStationName = savedDefaults.station_name;
    defaultsFuel = savedDefaults.fuel_grade_id
      ? `grade:${savedDefaults.fuel_grade_id}`
      : `type:${savedDefaults.fuel_type}`;
  }
  $: defaultsStationId =
    data.stations.find(
      (station: Row) =>
        String(station.name ?? "")
          .trim()
          .toLocaleLowerCase() ===
        defaultsStationName.trim().toLocaleLowerCase(),
    )?.id ?? "";
  $: defaultsGrade = data.grades.find(
    (grade: Row) => `grade:${grade.id}` === defaultsFuel,
  ) as Row | undefined;
  $: defaultsGradeId = defaultsGrade ? String(defaultsGrade.id) : "";
  $: defaultsFuelType = defaultsGrade
    ? String(defaultsGrade.fuel_type ?? "gasoline")
    : defaultsFuel.slice("type:".length);

  function fillNewForm(values: FuelFieldValues = {}) {
    newValues = { ...savedDefaults, ...values };
    newFormKey += 1;
  }

  function openNewSheet(values: FuelFieldValues = {}) {
    fillNewForm(values);
    newSheet?.open();
  }

  function repeatLast() {
    if (!lastRecord) return;
    fillNewForm({
      liters: decimalInput(lastRecord.liters, 3),
      total_price: decimalInput(
        Number(lastRecord.total_price_cents ?? 0) / 100,
        2,
        2,
      ),
      station_name: stationLabel(lastRecord),
      fuel_grade_id: String(lastRecord.fuel_grade_id ?? ""),
      fuel_type: String(lastRecord.fuel_type ?? "gasoline"),
      tank_full: Boolean(lastRecord.tank_full),
    });
    showToast($t("fuelUx.repeatFilled"), { tone: "info" });
  }

  function openScan() {
    newSheet?.close();
    scanSheet?.open();
  }

  let editingRow: Row | null = null;
  let editFormKey = 0;
  function openEdit(row: Row) {
    editingRow = row;
    editFormKey += 1;
    editSheet?.open();
  }
  $: editValues = editingRow
    ? ({
        motorcycle_id: String(editingRow.motorcycle_id ?? activeMotorcycleId),
        date: dateOnlyValue(editingRow.date) ?? undefined,
        odometer_km: String(editingRow.odometer_km ?? ""),
        liters: decimalInput(editingRow.liters, 3),
        total_price: decimalInput(
          Number(editingRow.total_price_cents ?? 0) / 100,
          2,
          2,
        ),
        station_name: stationLabel(editingRow),
        fuel_grade_id: String(editingRow.fuel_grade_id ?? ""),
        fuel_type: String(editingRow.fuel_type ?? "gasoline"),
        tank_full: Boolean(editingRow.tank_full),
        notes: String(editingRow.notes ?? ""),
      } satisfies FuelFieldValues)
    : {};

  // Quick-log deep link: /fuel?new=1 opens the new fill-up sheet once, then
  // drops the param so a refresh doesn't reopen it. ?settings=<tab> opens the
  // fill-up preferences (linked from Conta).
  afterNavigate(({ to }) => {
    const url = to?.url;
    if (!url) return;
    const isNew = url.searchParams.get("new") === "1";
    const settings = url.searchParams.get("settings");
    if (!isNew && !settings) return;
    if (isNew) openNewSheet();
    if (settings) {
      preferencesTab = preferencesTabs.some((tab) => tab.id === settings)
        ? (settings as typeof preferencesTab)
        : "defaults";
      preferencesSheet?.open();
    }
    const clean = new URL(url);
    clean.searchParams.delete("new");
    clean.searchParams.delete("settings");
    // The router finishes initialising after the first afterNavigate pass.
    setTimeout(() => {
      try {
        replaceState(`${clean.pathname}${clean.search}${clean.hash}`, {});
      } catch {
        history.replaceState(history.state, "", clean);
      }
    }, 0);
  });

  // Preferences sheet tabs
  let preferencesTab: "defaults" | "stations" | "grades" | "review" =
    "defaults";
  $: preferencesTabs = [
    { id: "defaults", label: $t("fuel.defaultsTitle") },
    { id: "stations", label: $t("fuel.stationsHeading") },
    { id: "grades", label: $t("fuel.gradesHeading") },
    { id: "review", label: $t("fuel.reviewTitle") },
  ] as const;

  // Key Signals
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  $: monthRows = data.rows.filter((r: Row) =>
    String(r.date ?? "").startsWith(currentMonthPrefix),
  );
  $: currentMonthSpend = monthRows.reduce(
    (sum: number, r: Row) => sum + Number(r.total_price_cents ?? 0),
    0,
  );
  $: monthlySpendValue =
    monthRows.length > 0
      ? brl(currentMonthSpend)
      : brl(data.summary.totalSpend);

  $: signals = [
    {
      label: $t("dashboard.monthlySpend"),
      value: monthlySpendValue,
      hint: monthRows.length > 0 ? undefined : $t("fuel.statsSpend"),
    },
    {
      label: $t("fuel.statsAverage"),
      value:
        data.summary.averageConsumption != null
          ? `${Number(data.summary.averageConsumption).toFixed(1)} km/L`
          : "—",
    },
    {
      label: $t("fuel.statsCostPerKm"),
      value:
        data.summary.costPerKm != null
          ? `${brl(Math.round(data.summary.costPerKm * 100))}/km`
          : "—",
    },
  ] satisfies Signal[];

  type EnhanceResult = {
    type: string;
    data?: { message?: unknown; imported?: unknown; ocr?: unknown };
  };

  const finishStatus = (result: EnhanceResult, successMessage?: string) => {
    if (result.type === "success") {
      errorMessage = "";
      showToast(successMessage ?? $t("common.actionSuccess"));
    } else if (result.type !== "redirect") {
      errorMessage = String(result.data?.message ?? $t("error.serverBody"));
    }
  };

  const enhanceWith =
    (successMessage: string): SubmitFunction =>
    () => {
      formBusy = true;
      errorMessage = "";
      return async ({ result, update }) => {
        formBusy = false;
        finishStatus(result, successMessage);
        await update();
      };
    };

  const enhanceDeleteWith =
    (successMessage: string, onDone?: () => void): SubmitFunction =>
    async ({ cancel }) => {
      const ok = await confirmDialog.ask($t("feature.confirmDelete"));
      if (!ok) {
        cancel();
        return;
      }
      formBusy = true;
      errorMessage = "";
      return async ({ result, update }) => {
        formBusy = false;
        finishStatus(result, successMessage);
        if (result.type === "success") onDone?.();
        await update();
      };
    };

  const handleImportConfirm: SubmitFunction = () => {
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      const imported = Number(
        (result as EnhanceResult).data?.imported ?? Number.NaN,
      );
      finishStatus(
        result,
        Number.isFinite(imported)
          ? $t("fuelUx.imported", { count: imported })
          : undefined,
      );
      await update();
    };
  };

  const handleCreateRecord: SubmitFunction = ({ formData, cancel }) => {
    formBusy = true;
    errorMessage = "";
    if (navigator.onLine) {
      void requestOfflineFuelSync().catch(() => undefined);
      return async ({ result, update }) => {
        formBusy = false;
        finishStatus(result, $t("fuelUx.saved"));
        if (result.type === "success") newSheet?.close();
        await update();
      };
    }
    cancel();
    void queueOfflineFuelSubmission(formData, $locale, data.user?.id)
      .then(() => {
        formBusy = false;
        showToast($t("offline.fuelQueued"), {
          tone: "info",
          action: { label: $t("offline.draftsTitle"), href: "/offline" },
        });
        newSheet?.close();
      })
      .catch((error) => {
        formBusy = false;
        errorMessage =
          error instanceof Error ? error.message : $t("offline.queueFailed");
      });
  };

  const handleUpdateRecord: SubmitFunction = () => {
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result, $t("fuelUx.updated"));
      if (result.type === "success") editSheet?.close();
      await update();
    };
  };

  /** The receipt is read, then the rider reviews it in the usual form. */
  const handleOcrScan: SubmitFunction = () => {
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      const ocr = (result as EnhanceResult).data?.ocr as
        Record<string, unknown> | undefined;
      if (result.type === "success" && ocr) {
        scanSheet?.close();
        openNewSheet({
          date: ocr.date ? String(ocr.date) : undefined,
          liters: decimalInput(ocr.liters, 3),
          total_price: decimalInput(ocr.total_price, 2, 2),
        });
        showToast($t("fuelUx.scanFilled"), { tone: "info" });
        return;
      }
      errorMessage = String(
        (result as EnhanceResult).data?.message ?? $t("error.serverBody"),
      );
      await update();
    };
  };

  const handleImportPreview: SubmitFunction = () => {
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        importSheet?.close();
      } else {
        finishStatus(result);
      }
      await update();
    };
  };

  const menuItemClass =
    "focus-ring flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]";
  const chipClass = (active: boolean) =>
    `focus-ring min-h-11 shrink-0 rounded-full border px-3 text-sm ${
      active
        ? "border-[var(--fg)] font-semibold text-[var(--fg)]"
        : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--fg)]"
    }`;
</script>

<section class="grid gap-6" aria-busy={formBusy}>
  <PageHeader
    title={$t("fuel.pageTitle")}
    description={$t("fuel.pageSubtitle")}
  >
    <svelte:fragment slot="actions">
      <PageAction
        label={$t("authenticatedUx.add")}
        ariaLabel={$t("fuel.newRecordTitle")}
        on:click={() => openNewSheet()}
      />
    </svelte:fragment>

    <!-- Data tools only; set-once preferences live behind one entry (and in
         Conta). Filters are on the page, above the list. -->
    <svelte:fragment slot="overflow">
      <PageOverflowMenu label={$t("authenticatedUx.moreActions")}>
        {#if hasRecords}
          <a class={menuItemClass} href="/fuel/export.csv">
            <Download
              size={16}
              class="text-[var(--muted)]"
              aria-hidden="true"
            />
            <span>{$t("common.exportCsv")}</span>
          </a>
        {/if}
        <button
          type="button"
          class={menuItemClass}
          on:click={() => importSheet.open()}
        >
          <Upload size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("fuel.importTitle")}</span>
        </button>
        <a class={menuItemClass} href="/offline">
          <CloudOff size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("offline.draftsTitle")}</span>
        </a>
        <div class="my-1 border-t border-[var(--line)]" role="separator"></div>
        <button
          type="button"
          class={menuItemClass}
          on:click={() => {
            preferencesTab = "defaults";
            preferencesSheet.open();
          }}
        >
          <SlidersHorizontal
            size={16}
            class="text-[var(--muted)]"
            aria-hidden="true"
          />
          <span>{$t("fuelUx.preferences")}</span>
        </button>
      </PageOverflowMenu>
    </svelte:fragment>
  </PageHeader>

  {#if visibleError}
    <div
      class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
      aria-live="assertive"
    >
      {visibleError}
    </div>
  {/if}

  <ConfirmDialog
    bind:this={confirmDialog}
    confirmLabel={$t("common.delete")}
    destructive
  />

  <!-- CSV Import Preview Confirmation -->
  {#if form?.previewRows}
    <div class="panel p-4">
      <h2 class="font-semibold">{$t("fuel.importPreviewHeading")}</h2>
      <div class="data-table mt-3 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>{$t("fuel.colDate")}</th>
              <th>{$t("fuel.colKm")}</th>
              <th>{$t("fuel.colLiters")}</th>
              <th>{$t("fuel.colTotal")}</th>
              <th>{$t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {#each form.previewRows as row}
              <tr class="border-t border-[var(--line)]">
                <td class="py-2" data-label="#">{row.row}</td>
                <td data-label={$t("fuel.colDate")}>{row.data.date}</td>
                <td class="numeric" data-label={$t("fuel.colKm")}>
                  {row.data.odometer_km}
                </td>
                <td class="numeric" data-label={$t("fuel.colLiters")}>
                  {row.data.liters}
                </td>
                <td class="numeric" data-label={$t("fuel.colTotal")}>
                  {brl(row.data.total_price_cents)}
                </td>
                <td data-label={$t("common.status")}>
                  {#if row.errors.length}
                    <StatusBadge tone="overdue">
                      {row.errors
                        .map((message: string) =>
                          actionMessage($locale, message),
                        )
                        .join(" ")}
                    </StatusBadge>
                  {:else}
                    <StatusBadge tone="ok">{$t("fuel.statusValid")}</StatusBadge
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <form
        class="mt-4 flex flex-wrap items-end gap-3"
        method="POST"
        action="?/importConfirm"
        use:enhance={handleImportConfirm}
      >
        <input type="hidden" name="rows_json" value={form.validRowsJson} />
        <div class="field-group">
          <label class="field-label" for="fuel-import-motorcycle">
            {$t("fuel.motorcycleLabel")}
          </label>
          <select
            class="field max-w-xs"
            id="fuel-import-motorcycle"
            name="motorcycle_id"
            value={activeMotorcycleId}
          >
            {#each data.motorcycles as moto}
              <option value={moto.id}>{moto.name}</option>
            {/each}
          </select>
        </div>
        <button class="button-primary" type="submit" disabled={formBusy}>
          {$t("fuel.importConfirmAction")}
        </button>
      </form>
    </div>
  {/if}

  {#if !hasRecords}
    <EmptyState
      icon={Fuel}
      title={$t("fuel.emptyRecords")}
      description={$t("fuel.emptyRecordsHint")}
    >
      {#snippet action()}
        <button
          class="button-primary"
          type="button"
          on:click={() => openNewSheet()}
        >
          {$t("fuelUx.emptyAction")}
        </button>
      {/snippet}
    </EmptyState>
  {:else}
    <!-- Key signals -->
    <SignalStrip {signals} />

    <!-- Filters: always visible, one row of chips above the list. -->
    <div
      class="flex items-center gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label={$t("authenticatedUx.filters")}
    >
      {#each periodChips as chip (chip.id)}
        <button
          type="button"
          class={chipClass(filterPeriod === chip.id)}
          aria-pressed={filterPeriod === chip.id}
          on:click={() => (filterPeriod = chip.id)}
        >
          {chip.label}
        </button>
      {/each}
      {#if stationOptions.length > 1}
        <label class="sr-only" for="fuel-filter-station">
          {$t("fuel.colStation")}
        </label>
        <select
          class="field min-h-11 w-auto shrink-0 rounded-full py-1 text-sm"
          id="fuel-filter-station"
          bind:value={filterStation}
        >
          <option value="">{$t("fuelUx.allStations")}</option>
          {#each stationOptions as station (station)}
            <option value={station}>{station}</option>
          {/each}
        </select>
      {/if}
    </div>

    <!-- History list: tap a row to edit it; delete lives in the edit sheet. -->
    <ActivityTimeline title={$t("fuel.historyHeading")} items={filteredRows}>
      <svelte:fragment slot="header-action">
        <div class="flex items-center gap-3">
          <span class="text-xs text-[var(--muted)]">
            {$t("fuel.resultCount", { count: filteredRows.length })}
          </span>
          {#if hasActiveFilters}
            <button
              type="button"
              class="focus-ring min-h-11 text-xs font-semibold text-[var(--fg)] underline underline-offset-2"
              on:click={clearFilters}
            >
              {$t("fuelUx.clearFilters")}
            </button>
          {/if}
        </div>
      </svelte:fragment>

      <svelte:fragment slot="item" let:item>
        {@const row = item}
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-[var(--panel-sunken)]"
          aria-label={`${$t("common.edit")} ${row.date}`}
          on:click={() => openEdit(row)}
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-semibold text-[var(--fg)]"
                >{row.date}</span
              >
              {#if stationLabel(row)}
                <span class="truncate text-xs text-[var(--muted)]">
                  · {stationLabel(row)}
                </span>
              {/if}
            </div>
            <div
              class="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]"
            >
              <span class="numeric">
                <strong class="font-medium text-[var(--fg)]"
                  >{row.odometer_km}</strong
                >
                km
              </span>
              <span class="numeric">
                <strong class="font-medium text-[var(--fg)]">
                  {decimalInput(row.liters, 3, 3)}
                </strong>
                L
              </span>
              <span class="numeric"
                >{price(Number(row.price_per_liter_millicents))}/L</span
              >
            </div>
          </div>
          <span
            class="display numeric shrink-0 text-lg font-bold text-[var(--fg)]"
          >
            {brl(Number(row.total_price_cents))}
          </span>
          <ChevronRight
            size={16}
            class="shrink-0 text-[var(--muted)]"
            aria-hidden="true"
          />
        </button>
      </svelte:fragment>

      <svelte:fragment slot="empty">
        <p class="text-sm text-[var(--muted)]">{$t("fuel.filterEmptyHint")}</p>
        <button
          class="button-secondary mt-4 min-h-11"
          type="button"
          on:click={clearFilters}
        >
          {$t("fuelUx.clearFilters")}
        </button>
      </svelte:fragment>
    </ActivityTimeline>

    <!-- Analysis after the list: the list is what the rider came for. -->
    {#if data.consumption.length >= 2}
      <div class="panel p-3 sm:p-4">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h2 class="label-tech text-xs text-[var(--muted)]">
            {$t("fuel.trendHeading")}
          </h2>
          <span class="text-xs text-[var(--muted)]">{$t("fuel.trendHint")}</span
          >
        </div>
        <TrendChart points={data.consumption} unit="km/L" />
      </div>
    {/if}

    <NearbyStations
      stations={data.stations.map((station: Row) => ({
        ...station,
        id: String(station.id),
        name: String(station.name),
      }))}
      records={data.rows}
      grades={data.grades.map((grade: Row) => ({
        id: String(grade.id),
        name: String(grade.name),
      }))}
    />
  {/if}
</section>

<!-- 1. New fill-up: the one form every "add fuel" path reaches. -->
<RecordSheet
  bind:this={newSheet}
  title={$t("fuel.newRecordTitle")}
  closeLabel={$t("common.close")}
>
  <div class="mb-4 grid grid-cols-2 gap-2">
    <button
      type="button"
      class="button-secondary min-h-11 gap-2 px-2 text-sm"
      on:click={openScan}
    >
      <Camera size={16} aria-hidden="true" />
      {$t("authenticatedUx.scanReceipt")}
    </button>
    <button
      type="button"
      class="button-secondary min-h-11 gap-2 px-2 text-sm"
      disabled={!lastRecord}
      on:click={repeatLast}
    >
      <RotateCcw size={16} aria-hidden="true" />
      {$t("authenticatedUx.repeatLast")}
    </button>
  </div>
  <form
    class="grid gap-3"
    method="POST"
    action="?/createRecord"
    enctype="multipart/form-data"
    use:enhance={handleCreateRecord}
  >
    {#key newFormKey}
      <FuelRecordFields
        idPrefix="fuel-new"
        motorcycles={data.motorcycles}
        stations={data.stations}
        grades={data.grades}
        initial={newValues}
        odometerHint={latestOdometer}
      />
    {/key}

    <div class="sheet-actions">
      <button
        type="button"
        class="button-secondary"
        on:click={() => newSheet.close()}
      >
        {$t("common.cancel")}
      </button>
      <button class="button-primary" type="submit" disabled={formBusy}>
        {$t("common.save")}
      </button>
    </div>
  </form>
</RecordSheet>

<!-- 2. Scan a receipt: read it, then review in the new fill-up form. -->
<RecordSheet
  bind:this={scanSheet}
  title={$t("fuel.ocrTitle")}
  description={$t("authenticatedUx.scanReceiptDesc")}
  closeLabel={$t("common.close")}
>
  <form
    class="grid gap-4"
    method="POST"
    action="?/ocrScan"
    enctype="multipart/form-data"
    use:enhance={handleOcrScan}
  >
    <div class="field-group">
      <label class="field-label" for="fuel-ocr-file">
        {$t("fuel.receiptLabel")}
      </label>
      <input
        class="field"
        id="fuel-ocr-file"
        type="file"
        name="receipt_file"
        accept="image/*,.pdf,.txt"
        required
      />
    </div>

    {#if formBusy}
      <p class="text-sm text-[var(--muted)]" aria-live="polite">
        {$t("authenticatedUx.processing")}
      </p>
    {/if}

    <div class="sheet-actions">
      <button
        type="button"
        class="button-secondary"
        on:click={() => {
          scanSheet.close();
          newSheet.open();
        }}
      >
        {$t("common.back")}
      </button>
      <button class="button-primary" type="submit" disabled={formBusy}>
        {$t("fuel.ocrScanAction")}
      </button>
    </div>
  </form>
</RecordSheet>

<!-- 3. Edit a fill-up; delete lives here, not on every row. -->
<RecordSheet
  bind:this={editSheet}
  title={$t("fuelUx.editTitle")}
  closeLabel={$t("common.close")}
>
  {#if editingRow}
    <form
      class="grid gap-3"
      method="POST"
      action="?/updateRecord"
      use:enhance={handleUpdateRecord}
    >
      <input type="hidden" name="id" value={String(editingRow.id)} />
      {#key editFormKey}
        <FuelRecordFields
          idPrefix="fuel-edit"
          motorcycles={data.motorcycles}
          stations={data.stations}
          grades={data.grades}
          initial={editValues}
          showReceipt={false}
        />
      {/key}
      {#if editingRow.receipt_file_key}
        <a
          class="focus-ring self-start text-sm font-semibold text-[var(--fg)] underline underline-offset-2"
          href={privateFileUrl(String(editingRow.receipt_file_key))}
          target="_blank"
          rel="noopener noreferrer"
        >
          {$t("common.openFile")}
        </a>
      {/if}

      <div class="sheet-actions">
        <button
          class="button-danger mr-auto"
          type="submit"
          form="fuel-delete-form"
          disabled={formBusy}
        >
          {$t("common.delete")}
        </button>
        <button class="button-primary" type="submit" disabled={formBusy}>
          {$t("common.saveChanges")}
        </button>
      </div>
    </form>
    <form
      id="fuel-delete-form"
      method="POST"
      action="?/deleteRecord"
      use:enhance={enhanceDeleteWith($t("fuelUx.deleted"), () =>
        editSheet?.close(),
      )}
    >
      <input type="hidden" name="id" value={String(editingRow.id)} />
    </form>
  {/if}
</RecordSheet>

<!-- 4. CSV Import Sheet -->
<RecordSheet
  bind:this={importSheet}
  title={$t("fuel.importTitle")}
  description={$t("fuel.csvHelp")}
  closeLabel={$t("common.close")}
>
  <form
    class="grid gap-4"
    method="POST"
    action="?/importPreview"
    enctype="multipart/form-data"
    use:enhance={handleImportPreview}
  >
    <div class="field-group">
      <label class="field-label" for="fuel-csv-file">CSV</label>
      <input
        class="field"
        id="fuel-csv-file"
        type="file"
        name="csv_file"
        accept=".csv,text/csv"
        required
      />
    </div>
    <div class="sheet-actions">
      <button
        type="button"
        class="button-secondary"
        on:click={() => importSheet.close()}
      >
        {$t("common.cancel")}
      </button>
      <button class="button-primary" type="submit" disabled={formBusy}>
        {$t("fuel.importPreviewAction")}
      </button>
    </div>
  </form>
</RecordSheet>

<!-- 5. Preferences & Settings Sheet -->
<RecordSheet
  bind:this={preferencesSheet}
  title={$t("fuel.toolsHeading")}
  description={$t("fuel.toolsSummary")}
  closeLabel={$t("common.close")}
>
  <div class="space-y-4">
    <!-- Tabs header -->
    <div class="flex flex-wrap gap-1 border-b border-[var(--line)] pb-2">
      {#each preferencesTabs as tab (tab.id)}
        <button
          type="button"
          aria-pressed={preferencesTab === tab.id}
          class="focus-ring min-h-11 rounded px-3 py-1 text-sm transition {preferencesTab ===
          tab.id
            ? 'bg-[var(--panel-sunken)] font-semibold text-[var(--fg)]'
            : 'font-medium text-[var(--muted)] hover:text-[var(--fg)]'}"
          on:click={() => (preferencesTab = tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Tab 1: Defaults: the same three choices the fill-up form offers. -->
    {#if preferencesTab === "defaults"}
      <form
        class="grid gap-3"
        method="POST"
        action="?/saveDefaults"
        use:enhance={enhanceWith($t("fuelUx.defaultsSaved"))}
      >
        <input type="hidden" name="motorcycle_id" value={activeMotorcycleId} />
        <input type="hidden" name="station_id" value={defaultsStationId} />
        <input type="hidden" name="fuel_grade_id" value={defaultsGradeId} />
        <input type="hidden" name="fuel_type" value={defaultsFuelType} />
        <div class="field-group">
          <label class="field-label" for="defaults-station-name">
            {$t("fuelUx.stationLabel")}
          </label>
          <input
            class="field"
            id="defaults-station-name"
            name="station_name"
            list="defaults-station-options"
            autocomplete="off"
            bind:value={defaultsStationName}
          />
          <datalist id="defaults-station-options">
            {#each data.stations as station (station.id)}
              <option value={String(station.name)}></option>
            {/each}
          </datalist>
        </div>
        <div class="field-group">
          <label class="field-label" for="defaults-fuel">
            {$t("fuelUx.fuelLabel")}
          </label>
          <select class="field" id="defaults-fuel" bind:value={defaultsFuel}>
            {#each data.grades as grade (grade.id)}
              <option value={`grade:${grade.id}`}>{grade.name}</option>
            {/each}
            <option value="type:gasoline">{$t("fuel.typeGasoline")}</option>
            <option value="type:ethanol">{$t("fuel.typeEthanol")}</option>
            <option value="type:flex">{$t("fuel.typeFlex")}</option>
            <option value="type:diesel">{$t("fuel.typeDiesel")}</option>
            <option value="type:gnv">{$t("fuel.typeGnv")}</option>
          </select>
        </div>

        <label
          class="flex min-h-11 items-center gap-2 text-sm"
          for="defaults-tank-full"
        >
          <input
            id="defaults-tank-full"
            type="checkbox"
            name="tank_full"
            value="true"
            checked={(defaults.tank_full as boolean | undefined) ?? true}
          />
          {$t("fuel.tankFullDefaultLabel")}
        </label>

        <div class="sheet-actions">
          <button class="button-primary" type="submit" disabled={formBusy}>
            {$t("fuel.saveDefaultsAction")}
          </button>
        </div>
      </form>
    {/if}

    <!-- Tab 2: Stations -->
    {#if preferencesTab === "stations"}
      <div class="space-y-4">
        <form
          class="grid gap-3"
          method="POST"
          action="?/saveStation"
          use:enhance={enhanceWith($t("fuelUx.stationSaved"))}
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="station-name">
                {$t("fuel.nameLabel")}
              </label>
              <input class="field" id="station-name" name="name" required />
            </div>
            <div class="field-group">
              <label class="field-label" for="station-brand">
                {$t("fuel.brandLabel")}
              </label>
              <input class="field" id="station-brand" name="brand" />
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="station-city">
                {$t("fuel.cityLabel")}
              </label>
              <input class="field" id="station-city" name="city" />
            </div>
            <div class="field-group">
              <label class="field-label" for="station-state">
                {$t("fuel.stateLabel")}
              </label>
              <input class="field" id="station-state" name="state" />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="station-notes">
              {$t("fuel.notesLabel")}
            </label>
            <textarea class="field min-h-16" id="station-notes" name="notes"
            ></textarea>
          </div>
          <LocationFields id="new-station" />
          <button
            class="button-primary justify-self-start"
            type="submit"
            disabled={formBusy}
          >
            {$t("fuel.saveStationAction")}
          </button>
        </form>

        <div class="border-t border-[var(--line)] pt-3">
          <h4 class="label-tech mb-2 text-xs text-[var(--muted)]">
            {$t("fuel.stationsHeading")}
          </h4>
          <ul class="divide-y divide-[var(--line)]">
            {#each data.stations as station (station.id)}
              <li
                class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
              >
                <span>{station.name}</span>
                <details class="w-full">
                  <summary class="cursor-pointer">{$t("common.edit")}</summary>
                  <form
                    class="mt-3 grid gap-3"
                    method="POST"
                    action="?/saveStation"
                    use:enhance={enhanceWith($t("fuelUx.stationSaved"))}
                  >
                    <input type="hidden" name="id" value={station.id} />
                    <input type="hidden" name="name" value={station.name} />
                    <input
                      type="hidden"
                      name="brand"
                      value={station.brand ?? ""}
                    />
                    <input
                      type="hidden"
                      name="city"
                      value={station.city ?? ""}
                    />
                    <input
                      type="hidden"
                      name="state"
                      value={station.state ?? ""}
                    />
                    <input
                      type="hidden"
                      name="notes"
                      value={station.notes ?? ""}
                    />
                    <LocationFields
                      id={`station-${station.id}`}
                      latitude={decimalInput(station.latitude, 6)}
                      longitude={decimalInput(station.longitude, 6)}
                    />
                    <button
                      class="button-primary justify-self-start"
                      type="submit"
                      disabled={formBusy}>{$t("common.save")}</button
                    >
                  </form>
                </details>
                <form
                  method="POST"
                  action="?/deleteStation"
                  use:enhance={enhanceDeleteWith($t("fuelUx.stationDeleted"))}
                >
                  <input type="hidden" name="id" value={station.id} />
                  <button
                    class="button-danger min-h-11 px-3 py-1 text-sm"
                    disabled={formBusy}
                    aria-label={`${$t("common.delete")} ${station.name}`}
                  >
                    {$t("common.delete")}
                  </button>
                </form>
              </li>
            {:else}
              <li class="py-2 text-sm text-[var(--muted)]">—</li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}

    <!-- Tab 3: Grades -->
    {#if preferencesTab === "grades"}
      <div class="space-y-4">
        <form
          class="grid gap-3"
          method="POST"
          action="?/saveGrade"
          use:enhance={enhanceWith($t("fuelUx.gradeSaved"))}
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="grade-name">
                {$t("fuel.nameLabel")}
              </label>
              <input class="field" id="grade-name" name="name" required />
            </div>
            <div class="field-group">
              <label class="field-label" for="grade-type">
                {$t("fuel.fuelTypeLabel")}
              </label>
              <select
                class="field"
                id="grade-type"
                name="fuel_type"
                value="gasoline"
              >
                <option value="gasoline">{$t("fuel.typeGasoline")}</option>
                <option value="ethanol">{$t("fuel.typeEthanol")}</option>
                <option value="flex">{$t("fuel.typeFlex")}</option>
                <option value="diesel">{$t("fuel.typeDiesel")}</option>
                <option value="gnv">{$t("fuel.typeGnv")}</option>
              </select>
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="field-group">
              <label class="field-label" for="grade-octane">
                {$t("fuel.octaneLabel")}
              </label>
              <input
                class="field"
                id="grade-octane"
                name="octane_rating"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                placeholder="95"
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="grade-ethanol">
                {$t("fuel.ethanolLabel")}
              </label>
              <input
                class="field"
                id="grade-ethanol"
                name="ethanol_percentage"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                pattern={DECIMAL_PATTERN}
                title={$t("fuelUx.decimalHint")}
                placeholder={$t("fuelUx.percentPlaceholder")}
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="grade-price">
                {$t("fuel.defaultPriceLabel")}
              </label>
              <input
                class="field"
                id="grade-price"
                name="default_price_per_liter"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                pattern={DECIMAL_PATTERN}
                title={$t("fuelUx.decimalHint")}
                placeholder={$t("fuelUx.pricePerLiterPlaceholder")}
              />
            </div>
          </div>
          <div class="field-group">
            <label class="field-label" for="grade-notes">
              {$t("fuel.notesLabel")}
            </label>
            <textarea class="field min-h-16" id="grade-notes" name="notes"
            ></textarea>
          </div>
          <button
            class="button-primary justify-self-start"
            type="submit"
            disabled={formBusy}
          >
            {$t("fuel.saveGradeAction")}
          </button>
        </form>

        <div class="border-t border-[var(--line)] pt-3">
          <h4 class="label-tech mb-2 text-xs text-[var(--muted)]">
            {$t("fuel.gradesHeading")}
          </h4>
          <ul class="divide-y divide-[var(--line)]">
            {#each data.grades as grade (grade.id)}
              <li class="flex items-center justify-between py-2 text-sm">
                <span>{grade.name}</span>
                <form
                  method="POST"
                  action="?/deleteGrade"
                  use:enhance={enhanceDeleteWith($t("fuelUx.gradeDeleted"))}
                >
                  <input type="hidden" name="id" value={grade.id} />
                  <button
                    class="button-danger min-h-11 px-3 py-1 text-sm"
                    disabled={formBusy}
                    aria-label={`${$t("common.delete")} ${grade.name}`}
                  >
                    {$t("common.delete")}
                  </button>
                </form>
              </li>
            {:else}
              <li class="py-2 text-sm text-[var(--muted)]">—</li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}

    <!-- Tab 4: Review Settings -->
    {#if preferencesTab === "review"}
      <form
        class="grid gap-3"
        method="POST"
        action="?/saveReviewSettings"
        use:enhance={enhanceWith($t("fuelUx.reviewSaved"))}
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="review-motorcycle">
              {$t("fuel.motorcycleLabel")}
            </label>
            <select
              class="field"
              id="review-motorcycle"
              name="motorcycle_id"
              required
            >
              <option value="">{$t("fuel.motorcycleLabel")}</option>
              {#each data.motorcycles as moto}
                <option value={moto.id}>{moto.name}</option>
              {/each}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="review-interval">
              {$t("fuel.reviewIntervalLabel")}
            </label>
            <input
              class="field"
              id="review-interval"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              name="fillups_interval"
              value="10"
            />
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm" for="review-active">
          <input
            id="review-active"
            type="checkbox"
            name="is_active"
            value="true"
            checked
          />
          {$t("fuel.reviewActiveLabel")}
        </label>
        <button
          class="button-primary justify-self-start"
          type="submit"
          disabled={formBusy}
        >
          {$t("fuel.saveReviewAction")}
        </button>
      </form>
    {/if}
  </div>
</RecordSheet>
