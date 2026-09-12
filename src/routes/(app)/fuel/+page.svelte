<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney, formatPreciseMoney } from "$lib/i18n";
  import {
    queueOfflineFuelSubmission,
    requestOfflineFuelSync,
  } from "$lib/utils/offline-fuel";
  import { privateFileUrl } from "$lib/utils/private-file-url";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import TrendChart from "$components/charts/TrendChart.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import BikeContextBar from "$lib/components/app/BikeContextBar.svelte";
  import SignalStrip, {
    type Signal,
  } from "$lib/components/app/SignalStrip.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import ActionMenu, {
    type ActionChoice,
  } from "$lib/components/app/ActionMenu.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import PageOverflowMenu from "$lib/components/app/PageOverflowMenu.svelte";
  import ActivityTimeline from "$lib/components/app/ActivityTimeline.svelte";
  import Download from "lucide-svelte/icons/download";
  import Filter from "lucide-svelte/icons/filter";
  import Upload from "lucide-svelte/icons/upload";
  import SlidersHorizontal from "lucide-svelte/icons/sliders-horizontal";
  import Fuel from "lucide-svelte/icons/fuel";
  import Settings from "lucide-svelte/icons/settings";
  import RotateCcw from "lucide-svelte/icons/rotate-ccw";

  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const price = (millicents: number) => formatPreciseMoney($locale, millicents);
  const today = () => new Date().toISOString().slice(0, 10);

  $: defaults = data.preferences[0] ?? {};
  let stationIdChoice = String(data.preferences[0]?.station_id ?? "");

  let selectedMotorcycleId = String(
    data.preferences[0]?.motorcycle_id ?? data.motorcycles[0]?.id ?? "all",
  );
  $: selectedMotorcycle =
    data.motorcycles.find(
      (moto: Record<string, unknown>) =>
        String(moto.id) === selectedMotorcycleId,
    ) ?? (data.motorcycles[0] as Record<string, unknown> | undefined);

  $: latestOdometerForSelected = (() => {
    if (!selectedMotorcycle) return null;
    const bikeRows = data.rows.filter(
      (r: Record<string, unknown>) =>
        String(r.motorcycle_id ?? "") === String(selectedMotorcycle.id),
    );
    if (bikeRows.length > 0 && bikeRows[0]?.odometer_km != null) {
      return bikeRows[0].odometer_km;
    }
    return selectedMotorcycle.current_odometer_km ?? null;
  })();

  // History filters
  let filterMotorcycle = "all";
  let filterStation = "";
  let filterPeriod = "all";
  let showFilters = false;

  $: hasActiveFilters =
    filterMotorcycle !== "all" ||
    Boolean(filterStation) ||
    filterPeriod !== "all";

  const PERIOD_DAYS: Record<string, number> = { "90d": 90, "12m": 365 };
  $: periodCutoff = PERIOD_DAYS[filterPeriod]
    ? new Date(Date.now() - PERIOD_DAYS[filterPeriod] * 86400000)
        .toISOString()
        .slice(0, 10)
    : null;

  $: filteredRows = data.rows.filter((row: Record<string, unknown>) => {
    if (
      filterMotorcycle !== "all" &&
      String(row.motorcycle_id ?? "") !== filterMotorcycle
    ) {
      return false;
    }
    if (
      filterStation &&
      !String(row.station_name ?? "")
        .toLowerCase()
        .includes(filterStation.toLowerCase())
    ) {
      return false;
    }
    if (periodCutoff && String(row.date ?? "") < periodCutoff) return false;
    return true;
  });

  $: motorcycleNameById = new Map(
    data.motorcycles.map((moto: Record<string, unknown>) => [
      String(moto.id),
      String(moto.name),
    ]),
  );

  // Status & dialog state
  let offlineMessage = "";
  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

  // Sheet dialog refs
  let actionMenu: ActionMenu;
  let scanSheet: RecordSheet;
  let manualSheet: RecordSheet;
  let repeatSheet: RecordSheet;
  let importSheet: RecordSheet;
  let preferencesSheet: RecordSheet;

  // OCR state
  let ocrReview = false;
  $: if (form?.ocr) {
    ocrReview = true;
    if (typeof window !== "undefined") {
      setTimeout(() => {
        scanSheet?.open();
      }, 0);
    }
  }

  // Preferences sheet tabs
  let preferencesTab: "defaults" | "stations" | "grades" | "review" =
    "defaults";

  // Action menu choices
  $: actionChoices = [
    {
      id: "fuel-scan",
      label: $t("authenticatedUx.scanReceipt"),
      description: $t("authenticatedUx.scanReceiptDesc"),
      recommended: true,
    },
    {
      id: "fuel-manual",
      label: $t("authenticatedUx.enterManually"),
      description: $t("authenticatedUx.enterManuallyDesc"),
    },
    ...(data.rows.length > 0
      ? [
          {
            id: "fuel-repeat",
            label: $t("authenticatedUx.repeatLast"),
            description: $t("authenticatedUx.repeatLastDesc"),
          },
        ]
      : []),
  ] satisfies ActionChoice[];

  function handleActionSelect(event: CustomEvent<string>) {
    const choice = event.detail;
    if (choice === "fuel-scan") {
      scanSheet?.open();
    } else if (choice === "fuel-manual") {
      manualSheet?.open();
    } else if (choice === "fuel-repeat") {
      repeatSheet?.open();
    }
  }

  // Key Signals
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  $: monthRows = data.rows.filter((r: Record<string, unknown>) =>
    String(r.date ?? "").startsWith(currentMonthPrefix),
  );
  $: currentMonthSpend = monthRows.reduce(
    (sum: number, r: Record<string, unknown>) =>
      sum + Number(r.total_price_cents ?? 0),
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
      hint: $t("fuel.trendHint"),
    },
    {
      label: $t("fuel.statsCostPerKm"),
      value:
        data.summary.costPerKm != null
          ? `${brl(Math.round(data.summary.costPerKm * 100))}/km`
          : "—",
    },
  ] satisfies Signal[];

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

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask($t("feature.confirmDelete"));
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };

  const handleCreateRecord: SubmitFunction = ({ formData, cancel }) => {
    offlineMessage = "";
    formBusy = true;
    statusMessage = "";
    if (navigator.onLine) {
      void requestOfflineFuelSync().catch(() => undefined);
      return async ({ result, update }) => {
        formBusy = false;
        finishStatus(result);
        if (result.type === "success") {
          manualSheet?.close();
          scanSheet?.close();
          ocrReview = false;
        }
        await update();
      };
    }
    cancel();
    void queueOfflineFuelSubmission(formData)
      .then(() => {
        formBusy = false;
        statusRole = "status";
        offlineMessage =
          "Sem conexão: abastecimento guardado na fila offline e será enviado ao reconectar.";
        manualSheet?.close();
        scanSheet?.close();
        ocrReview = false;
      })
      .catch((error) => {
        formBusy = false;
        statusRole = "alert";
        offlineMessage =
          error instanceof Error
            ? error.message
            : "Não foi possível guardar o abastecimento offline.";
      });
  };

  const handleOcrScan: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        statusRole = "status";
        ocrReview = true;
      } else {
        statusRole = "alert";
        statusMessage = String(
          (result as { data?: { message?: unknown } }).data?.message ??
            $t("error.serverBody"),
        );
      }
      await update();
    };
  };

  const handleRepeatSubmit: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      if (result.type === "success") {
        repeatSheet?.close();
      }
      await update();
    };
  };

  const handleImportPreview: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      if (result.type === "success") {
        importSheet?.close();
      }
      await update();
    };
  };
</script>

<section class="grid gap-6" aria-busy={formBusy}>
  <PageHeader
    eyebrow={$t("nav.fuel")}
    title={$t("fuel.pageTitle")}
    description={$t("fuel.pageSubtitle")}
  >
    <svelte:fragment slot="actions">
      <PageAction
        label={$t("authenticatedUx.add")}
        ariaLabel={$t("fuel.newRecordTitle")}
        on:click={() => actionMenu.open()}
      />
    </svelte:fragment>

    <svelte:fragment slot="overflow">
      <PageOverflowMenu label={$t("authenticatedUx.moreActions")}>
        <a
          class="focus-ring flex items-center gap-2 rounded px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]"
          href="/fuel/export.csv"
        >
          <Download size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("common.exportCsv")}</span>
        </a>
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]"
          on:click={() => (showFilters = !showFilters)}
        >
          <Filter size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("authenticatedUx.filters")}</span>
        </button>
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]"
          on:click={() => importSheet.open()}
        >
          <Upload size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("fuel.importTitle")}</span>
        </button>
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]"
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
          <span>{$t("fuel.defaultsTitle")}</span>
        </button>
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]"
          on:click={() => {
            preferencesTab = "stations";
            preferencesSheet.open();
          }}
        >
          <Fuel size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("fuel.stationsHeading")}</span>
        </button>
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]"
          on:click={() => {
            preferencesTab = "grades";
            preferencesSheet.open();
          }}
        >
          <Settings size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("fuel.gradesHeading")}</span>
        </button>
        <button
          type="button"
          class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--panel-sunken)]"
          on:click={() => {
            preferencesTab = "review";
            preferencesSheet.open();
          }}
        >
          <RotateCcw size={16} class="text-[var(--muted)]" aria-hidden="true" />
          <span>{$t("fuel.reviewTitle")}</span>
        </button>
      </PageOverflowMenu>
    </svelte:fragment>

    <svelte:fragment slot="context">
      <div class="mt-4">
        <BikeContextBar
          name={selectedMotorcycle
            ? String(selectedMotorcycle.name)
            : $t("dashboard.noActiveBike")}
          odometerKm={latestOdometerForSelected}
          ariaLabel={$t("fuel.motorcycleLabel")}
        >
          <svelte:fragment slot="selection">
            {#if data.motorcycles.length > 1}
              <select
                class="field max-w-[180px] py-1 text-xs"
                bind:value={selectedMotorcycleId}
                on:change={() => {
                  if (selectedMotorcycleId !== "all") {
                    filterMotorcycle = selectedMotorcycleId;
                  }
                }}
                aria-label={$t("authenticatedUx.selectBike")}
              >
                <option value="all">{$t("authenticatedUx.allBikes")}</option>
                {#each data.motorcycles as moto}
                  <option value={moto.id}>{moto.name}</option>
                {/each}
              </select>
            {/if}
          </svelte:fragment>
        </BikeContextBar>
      </div>
    </svelte:fragment>
  </PageHeader>

  {#if data.errorMessage || form?.message}
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
    >
      {data.errorMessage || form?.message}
    </div>
  {/if}

  {#if offlineMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {offlineMessage}
    </p>
  {/if}

  {#if statusMessage && !offlineMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
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

  <!-- Key signals -->
  <SignalStrip {signals} />

  <!-- Compact Trend Chart -->
  {#if data.consumption.length >= 2}
    <div class="panel p-3 sm:p-4">
      <div class="mb-2 flex items-center justify-between gap-2">
        <h2 class="label-tech text-xs text-[var(--muted)]">
          {$t("fuel.trendHeading")}
        </h2>
        <span class="text-xs text-[var(--muted)]">{$t("fuel.trendHint")}</span>
      </div>
      <TrendChart points={data.consumption} unit="km/L" />
    </div>
  {/if}

  <!-- CSV Import Preview Confirmation -->
  {#if form?.previewRows}
    <div class="panel p-4">
      <h2 class="font-semibold">{$t("fuel.importPreviewHeading")}</h2>
      <div class="fuel-table-scroll mt-3 overflow-x-auto">
        <table class="fuel-table w-full text-left text-sm">
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
                <td data-label={$t("fuel.colKm")}>{row.data.odometer_km}</td>
                <td data-label={$t("fuel.colLiters")}>{row.data.liters}</td>
                <td data-label={$t("fuel.colTotal")}>
                  {brl(row.data.total_price_cents)}
                </td>
                <td data-label={$t("common.status")}>
                  {row.errors.length
                    ? row.errors.join(" ")
                    : $t("fuel.statusValid")}
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
        use:enhance={enhanceWithStatus}
      >
        <input type="hidden" name="rows_json" value={form.validRowsJson} />
        <label class="field-label" for="fuel-import-motorcycle">
          {$t("fuel.motorcycleLabel")}
        </label>
        <select
          class="field max-w-xs"
          id="fuel-import-motorcycle"
          name="motorcycle_id"
        >
          <option value="">{$t("fuel.filterAllMotorcycles")}</option>
          {#each data.motorcycles as moto}
            <option value={moto.id}>{moto.name}</option>
          {/each}
        </select>
        <button class="button-primary" type="submit" disabled={formBusy}>
          {$t("fuel.importConfirmAction")}
        </button>
      </form>
    </div>
  {/if}

  <!-- Filters drawer / bar -->
  {#if showFilters || hasActiveFilters}
    <div class="panel grid gap-3 p-3 sm:grid-cols-3 sm:p-4">
      <div class="field-group min-w-0">
        <label class="field-label text-xs" for="fuel-filter-motorcycle">
          {$t("fuel.motorcycleLabel")}
        </label>
        <select
          class="field py-1.5 text-xs"
          id="fuel-filter-motorcycle"
          bind:value={filterMotorcycle}
        >
          <option value="all">{$t("fuel.filterAllMotorcycles")}</option>
          {#each data.motorcycles as moto}
            <option value={moto.id}>{moto.name}</option>
          {/each}
        </select>
      </div>
      <div class="field-group min-w-0">
        <label class="field-label text-xs" for="fuel-filter-station">
          {$t("fuel.colStation")}
        </label>
        <input
          class="field py-1.5 text-xs"
          id="fuel-filter-station"
          type="search"
          placeholder={$t("fuel.filterStationPlaceholder")}
          bind:value={filterStation}
        />
      </div>
      <div class="field-group min-w-0">
        <label class="field-label text-xs" for="fuel-filter-period">
          {$t("fuel.filterPeriod")}
        </label>
        <select
          class="field py-1.5 text-xs"
          id="fuel-filter-period"
          bind:value={filterPeriod}
        >
          <option value="90d">{$t("fuel.period90d")}</option>
          <option value="12m">{$t("fuel.period12m")}</option>
          <option value="all">{$t("fuel.periodAll")}</option>
        </select>
      </div>
    </div>
  {/if}

  <!-- Activity Timeline of records -->
  <ActivityTimeline
    title={$t("fuel.historyHeading")}
    emptyMessage={$t("fuel.emptyRecords")}
    items={filteredRows}
  >
    <svelte:fragment slot="header-action">
      <div class="flex items-center gap-3">
        <span class="text-xs text-[var(--muted)]">
          {$t("fuel.resultCount", { count: filteredRows.length })}
        </span>
        {#if hasActiveFilters}
          <button
            type="button"
            class="text-xs font-semibold text-[var(--accent)] hover:underline"
            on:click={() => {
              filterMotorcycle = "all";
              filterStation = "";
              filterPeriod = "all";
            }}
          >
            Limpar filtros
          </button>
        {/if}
      </div>
    </svelte:fragment>

    <svelte:fragment slot="item" let:item>
      {@const row = item}
      <div
        class="flex flex-col gap-2 px-1 py-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold text-[var(--fg)]"
              >{row.date}</span
            >
            {#if row.motorcycle_id}
              <span
                class="label-tech rounded bg-[var(--panel-sunken)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]"
              >
                {motorcycleNameById.get(String(row.motorcycle_id)) ?? "—"}
              </span>
            {/if}
            {#if row.station_name}
              <span class="truncate text-xs text-[var(--muted)]">
                · {row.station_name}
              </span>
            {/if}
          </div>
          <div
            class="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]"
          >
            <span>
              <strong class="font-medium text-[var(--fg)]"
                >{row.odometer_km}</strong
              >
              km
            </span>
            <span>
              <strong class="font-medium text-[var(--fg)]">
                {Number(row.liters).toFixed(3)}
              </strong>
              L
            </span>
            <span>{price(Number(row.price_per_liter_millicents))}/L</span>
            {#if row.receipt_file_key}
              <a
                class="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                href={privateFileUrl(String(row.receipt_file_key))}
                target="_blank"
                rel="noopener noreferrer"
              >
                {$t("common.openFile")}
              </a>
            {/if}
          </div>
        </div>

        <div
          class="flex shrink-0 items-center justify-between gap-4 sm:justify-end"
        >
          <span class="display numeric text-lg font-bold text-[var(--fg)]">
            {brl(Number(row.total_price_cents))}
          </span>
          <form
            method="POST"
            action="?/deleteRecord"
            use:enhance={enhanceDelete}
          >
            <input type="hidden" name="id" value={row.id} />
            <button
              class="button-danger min-h-11 px-3 py-1 text-xs"
              type="submit"
              disabled={formBusy}
              aria-label={`${$t("common.delete")} ${row.date}`}
            >
              {$t("common.delete")}
            </button>
          </form>
        </div>
      </div>
    </svelte:fragment>

    <svelte:fragment slot="empty">
      <div class="py-4 text-center">
        <p class="display text-2xl">{$t("fuel.emptyRecords")}</p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          {data.rows.length > 0
            ? $t("fuel.filterEmptyHint")
            : $t("fuel.emptyRecordsHint")}
        </p>
        {#if data.rows.length === 0}
          <button
            class="button-secondary mt-4 inline-block min-h-11"
            type="button"
            on:click={() => actionMenu.open()}
          >
            {$t("fuel.newRecordTitle")}
          </button>
        {/if}
      </div>
    </svelte:fragment>
  </ActivityTimeline>
</section>

<!-- Action Menu (Primary Action Modal Choices) -->
<ActionMenu
  bind:this={actionMenu}
  title={$t("fuel.newRecordTitle")}
  closeLabel={$t("common.close")}
  recommendedLabel={$t("pricing.recommended")}
  choices={actionChoices}
  on:select={handleActionSelect}
/>

<!-- 1. Scan/OCR RecordSheet -->
<RecordSheet
  bind:this={scanSheet}
  title={ocrReview ? $t("fuel.ocrFoundTitle") : $t("fuel.ocrTitle")}
  description={ocrReview
    ? $t("authenticatedUx.reviewBeforeSaving")
    : $t("authenticatedUx.scanReceiptDesc")}
  closeLabel={$t("common.close")}
  on:close={() => {
    ocrReview = false;
  }}
>
  {#if !ocrReview}
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

      <div
        class="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3"
      >
        <button
          type="button"
          class="button-secondary"
          on:click={() => scanSheet.close()}
        >
          {$t("common.cancel")}
        </button>
        <button class="button-primary" type="submit" disabled={formBusy}>
          {$t("fuel.ocrScanAction")}
        </button>
      </div>
    </form>
  {:else}
    <div
      class="mb-4 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm"
    >
      <p class="font-semibold text-[var(--accent)]">
        {$t("fuel.ocrFoundTitle")}
      </p>
      <p class="mt-1 text-xs text-[var(--muted)]">
        {$t("fuel.ocrFoundHint")}
      </p>
    </div>

    <form
      class="grid gap-3"
      method="POST"
      action="?/createRecord"
      enctype="multipart/form-data"
      use:enhance={handleCreateRecord}
    >
      <label class="field-label" for="ocr-motorcycle">
        {$t("fuel.motorcycleLabel")}
      </label>
      <select class="field" id="ocr-motorcycle" name="motorcycle_id">
        <option value="">{$t("fuel.motorcycleLabel")}</option>
        {#each data.motorcycles as moto}
          <option
            value={moto.id}
            selected={selectedMotorcycleId === moto.id ||
              defaults.motorcycle_id === moto.id}
          >
            {moto.name}
          </option>
        {/each}
      </select>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="ocr-date">
            {$t("fuel.dateLabel")}
          </label>
          <input
            class="field"
            id="ocr-date"
            type="date"
            name="date"
            value={form?.ocr?.date ?? today()}
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="ocr-odometer">
            {$t("fuel.odometerLabel")}
          </label>
          <input
            class="field"
            id="ocr-odometer"
            type="number"
            name="odometer_km"
            required
          />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="ocr-liters">
            {$t("fuel.litersLabel")}
          </label>
          <input
            class="field"
            id="ocr-liters"
            type="number"
            step="0.001"
            name="liters"
            value={form?.ocr?.liters ?? ""}
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="ocr-total-price">
            {$t("fuel.totalPriceLabel")}
          </label>
          <input
            class="field"
            id="ocr-total-price"
            type="number"
            step="0.01"
            name="total_price"
            value={form?.ocr?.total_price ?? ""}
            required
          />
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="ocr-price-per-liter">
          {$t("fuel.pricePerLiterLabel")}
        </label>
        <input
          class="field"
          id="ocr-price-per-liter"
          type="number"
          step="0.001"
          name="price_per_liter"
          value={form?.ocr?.price_per_liter ?? ""}
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="ocr-station">
            {$t("fuel.stationSavedLabel")}
          </label>
          <select
            class="field"
            id="ocr-station"
            name="station_id"
            bind:value={stationIdChoice}
          >
            <option value="">{$t("fuel.stationAnyLabel")}</option>
            {#each data.stations as station}
              <option value={station.id}>{station.name}</option>
            {/each}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label" for="ocr-grade">
            {$t("fuel.gradeSavedLabel")}
          </label>
          <select class="field" id="ocr-grade" name="fuel_grade_id">
            <option value="">{$t("fuel.gradeSavedLabel")}</option>
            {#each data.grades as grade}
              <option
                value={grade.id}
                selected={defaults.fuel_grade_id === grade.id}
              >
                {grade.name}
              </option>
            {/each}
          </select>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="field-group">
          <label class="field-label" for="ocr-station-name">
            {$t("fuel.stationNameLabel")}
          </label>
          <input
            class="field"
            id="ocr-station-name"
            name="station_name"
            value={defaults.station_name ?? ""}
            disabled={Boolean(stationIdChoice)}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="ocr-fuel-type">
            {$t("fuel.fuelTypeLabel")}
          </label>
          <select
            class="field"
            id="ocr-fuel-type"
            name="fuel_type"
            value={defaults.fuel_type ?? "gasoline"}
          >
            <option value="gasoline">{$t("fuel.typeGasoline")}</option>
            <option value="ethanol">{$t("fuel.typeEthanol")}</option>
            <option value="flex">{$t("fuel.typeFlex")}</option>
            <option value="diesel">{$t("fuel.typeDiesel")}</option>
            <option value="gnv">{$t("fuel.typeGnv")}</option>
          </select>
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm" for="ocr-tank-full">
        <input
          id="ocr-tank-full"
          type="checkbox"
          name="tank_full"
          value="true"
          checked={defaults.tank_full ?? true}
        />
        {$t("fuel.tankFullLabel")}
      </label>

      <div class="field-group">
        <label class="field-label" for="ocr-notes">
          {$t("fuel.notesLabel")}
        </label>
        <textarea class="field min-h-16" id="ocr-notes" name="notes"></textarea>
      </div>

      <div
        class="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
      >
        <button
          type="button"
          class="button-secondary"
          on:click={() => {
            ocrReview = false;
          }}
        >
          {$t("common.back")}
        </button>
        <button class="button-primary" type="submit" disabled={formBusy}>
          {$t("common.save")}
        </button>
      </div>
    </form>
  {/if}
</RecordSheet>

<!-- 2. Manual Entry RecordSheet -->
<RecordSheet
  bind:this={manualSheet}
  title={$t("fuel.newRecordTitle")}
  description={$t("authenticatedUx.enterManuallyDesc")}
  closeLabel={$t("common.close")}
>
  <form
    class="grid gap-3"
    method="POST"
    action="?/createRecord"
    enctype="multipart/form-data"
    use:enhance={handleCreateRecord}
  >
    <label class="field-label" for="fuel-manual-motorcycle">
      {$t("fuel.motorcycleLabel")}
    </label>
    <select class="field" id="fuel-manual-motorcycle" name="motorcycle_id">
      <option value="">{$t("fuel.motorcycleLabel")}</option>
      {#each data.motorcycles as moto}
        <option
          value={moto.id}
          selected={selectedMotorcycleId === moto.id ||
            defaults.motorcycle_id === moto.id}
        >
          {moto.name}
        </option>
      {/each}
    </select>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="field-group">
        <label class="field-label" for="fuel-manual-date">
          {$t("fuel.dateLabel")}
        </label>
        <input
          class="field"
          id="fuel-manual-date"
          type="date"
          name="date"
          value={today()}
          required
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="fuel-manual-odometer">
          {$t("fuel.odometerLabel")}
        </label>
        <input
          class="field"
          id="fuel-manual-odometer"
          type="number"
          name="odometer_km"
          required
        />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="field-group">
        <label class="field-label" for="fuel-manual-liters">
          {$t("fuel.litersLabel")}
        </label>
        <input
          class="field"
          id="fuel-manual-liters"
          type="number"
          step="0.001"
          name="liters"
          required
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="fuel-manual-total-price">
          {$t("fuel.totalPriceLabel")}
        </label>
        <input
          class="field"
          id="fuel-manual-total-price"
          type="number"
          step="0.01"
          name="total_price"
          required
        />
      </div>
    </div>

    <div class="field-group">
      <label class="field-label" for="fuel-manual-price-per-liter">
        {$t("fuel.pricePerLiterLabel")}
      </label>
      <input
        class="field"
        id="fuel-manual-price-per-liter"
        type="number"
        step="0.001"
        name="price_per_liter"
        value={defaults.price_per_liter_millicents
          ? defaults.price_per_liter_millicents / 100000
          : ""}
      />
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="field-group">
        <label class="field-label" for="fuel-manual-station">
          {$t("fuel.stationSavedLabel")}
        </label>
        <select
          class="field"
          id="fuel-manual-station"
          name="station_id"
          bind:value={stationIdChoice}
        >
          <option value="">{$t("fuel.stationAnyLabel")}</option>
          {#each data.stations as station}
            <option value={station.id}>{station.name}</option>
          {/each}
        </select>
      </div>
      <div class="field-group">
        <label class="field-label" for="fuel-manual-grade">
          {$t("fuel.gradeSavedLabel")}
        </label>
        <select class="field" id="fuel-manual-grade" name="fuel_grade_id">
          <option value="">{$t("fuel.gradeSavedLabel")}</option>
          {#each data.grades as grade}
            <option
              value={grade.id}
              selected={defaults.fuel_grade_id === grade.id}
            >
              {grade.name}
            </option>
          {/each}
        </select>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="field-group">
        <label class="field-label" for="fuel-manual-station-name">
          {$t("fuel.stationNameLabel")}
        </label>
        <input
          class="field"
          id="fuel-manual-station-name"
          name="station_name"
          value={defaults.station_name ?? ""}
          disabled={Boolean(stationIdChoice)}
        />
        <p class="field-help text-xs text-[var(--muted)]">
          {$t("fuel.stationNameHelp")}
        </p>
      </div>
      <div class="field-group">
        <label class="field-label" for="fuel-manual-type">
          {$t("fuel.fuelTypeLabel")}
        </label>
        <select
          class="field"
          id="fuel-manual-type"
          name="fuel_type"
          value={defaults.fuel_type ?? "gasoline"}
        >
          <option value="gasoline">{$t("fuel.typeGasoline")}</option>
          <option value="ethanol">{$t("fuel.typeEthanol")}</option>
          <option value="flex">{$t("fuel.typeFlex")}</option>
          <option value="diesel">{$t("fuel.typeDiesel")}</option>
          <option value="gnv">{$t("fuel.typeGnv")}</option>
        </select>
      </div>
    </div>

    <label class="flex items-center gap-2 text-sm" for="fuel-manual-tank-full">
      <input
        id="fuel-manual-tank-full"
        type="checkbox"
        name="tank_full"
        value="true"
        checked={defaults.tank_full ?? true}
      />
      {$t("fuel.tankFullLabel")}
    </label>

    <div class="field-group">
      <label class="field-label" for="fuel-manual-notes">
        {$t("fuel.notesLabel")}
      </label>
      <textarea class="field min-h-16" id="fuel-manual-notes" name="notes"
      ></textarea>
    </div>

    <div class="field-group">
      <label class="field-label" for="fuel-manual-receipt">
        {$t("fuel.receiptLabel")}
      </label>
      <input
        class="field"
        id="fuel-manual-receipt"
        type="file"
        name="receipt_file"
        accept="image/*,.pdf,.txt"
      />
    </div>

    <div
      class="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3"
    >
      <button
        type="button"
        class="button-secondary"
        on:click={() => manualSheet.close()}
      >
        {$t("common.cancel")}
      </button>
      <button class="button-primary" type="submit" disabled={formBusy}>
        {$t("common.save")}
      </button>
    </div>
  </form>
</RecordSheet>

<!-- 3. Repeat Last RecordSheet -->
<RecordSheet
  bind:this={repeatSheet}
  title={$t("fuel.repeatTitle")}
  description={$t("authenticatedUx.repeatLastDesc")}
  closeLabel={$t("common.close")}
>
  <form
    class="grid gap-3"
    method="POST"
    action="?/repeatLast"
    use:enhance={handleRepeatSubmit}
  >
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="field-group">
        <label class="field-label" for="fuel-repeat-date">
          {$t("fuel.dateLabel")}
        </label>
        <input
          class="field"
          id="fuel-repeat-date"
          type="date"
          name="date"
          value={today()}
          required
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="fuel-repeat-odometer">
          {$t("fuel.newOdometerLabel")}
        </label>
        <input
          class="field"
          id="fuel-repeat-odometer"
          type="number"
          name="odometer_km"
          required
        />
      </div>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="field-group">
        <label class="field-label" for="fuel-repeat-liters">
          {$t("fuel.litersLabel")}
        </label>
        <input
          class="field"
          id="fuel-repeat-liters"
          type="number"
          step="0.001"
          name="liters"
          value={data.rows[0]?.liters ?? ""}
          required
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="fuel-repeat-total">
          {$t("fuel.totalPriceLabel")}
        </label>
        <input
          class="field"
          id="fuel-repeat-total"
          type="number"
          step="0.01"
          name="total_price"
          value={data.rows[0]?.total_price_cents
            ? (Number(data.rows[0].total_price_cents) / 100).toFixed(2)
            : ""}
          required
        />
      </div>
    </div>
    <div
      class="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3"
    >
      <button
        type="button"
        class="button-secondary"
        on:click={() => repeatSheet.close()}
      >
        {$t("common.cancel")}
      </button>
      <button class="button-primary" type="submit" disabled={formBusy}>
        {$t("fuel.repeatAction")}
      </button>
    </div>
  </form>
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
      <p class="field-help text-xs text-[var(--muted)]">{$t("fuel.csvHelp")}</p>
    </div>
    <div
      class="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3"
    >
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
    <div
      class="flex flex-wrap gap-1 border-b border-[var(--line)] pb-2 text-xs"
    >
      <button
        type="button"
        class="focus-ring rounded px-2.5 py-1 font-medium transition {preferencesTab ===
        'defaults'
          ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
          : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
        on:click={() => (preferencesTab = "defaults")}
      >
        {$t("fuel.defaultsTitle")}
      </button>
      <button
        type="button"
        class="focus-ring rounded px-2.5 py-1 font-medium transition {preferencesTab ===
        'stations'
          ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
          : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
        on:click={() => (preferencesTab = "stations")}
      >
        {$t("fuel.stationsHeading")}
      </button>
      <button
        type="button"
        class="focus-ring rounded px-2.5 py-1 font-medium transition {preferencesTab ===
        'grades'
          ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
          : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
        on:click={() => (preferencesTab = "grades")}
      >
        {$t("fuel.gradesHeading")}
      </button>
      <button
        type="button"
        class="focus-ring rounded px-2.5 py-1 font-medium transition {preferencesTab ===
        'review'
          ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
          : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
        on:click={() => (preferencesTab = "review")}
      >
        {$t("fuel.reviewTitle")}
      </button>
    </div>

    <!-- Tab 1: Defaults -->
    {#if preferencesTab === "defaults"}
      <form
        class="grid gap-3"
        method="POST"
        action="?/saveDefaults"
        use:enhance={enhanceWithStatus}
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="defaults-motorcycle">
              {$t("fuel.motorcycleLabel")}
            </label>
            <select class="field" id="defaults-motorcycle" name="motorcycle_id">
              <option value="">{$t("fuel.motorcycleLabel")}</option>
              {#each data.motorcycles as moto}
                <option value={moto.id}>{moto.name}</option>
              {/each}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="defaults-station">
              {$t("fuel.stationSavedLabel")}
            </label>
            <select class="field" id="defaults-station" name="station_id">
              <option value="">{$t("fuel.stationSavedLabel")}</option>
              {#each data.stations as station}
                <option value={station.id}>{station.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="defaults-grade">
              {$t("fuel.gradeSavedLabel")}
            </label>
            <select class="field" id="defaults-grade" name="fuel_grade_id">
              <option value="">{$t("fuel.gradeSavedLabel")}</option>
              {#each data.grades as grade}
                <option value={grade.id}>{grade.name}</option>
              {/each}
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="defaults-price">
              {$t("fuel.pricePerLiterLabel")}
            </label>
            <input class="field" id="defaults-price" name="price_per_liter" />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="defaults-station-name">
              {$t("fuel.stationAnyLabel")}
            </label>
            <input
              class="field"
              id="defaults-station-name"
              name="station_name"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="defaults-fuel-type">
              {$t("fuel.fuelTypeLabel")}
            </label>
            <input
              class="field"
              id="defaults-fuel-type"
              name="fuel_type"
              value="gasoline"
            />
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm" for="defaults-tank-full">
          <input
            id="defaults-tank-full"
            type="checkbox"
            name="tank_full"
            value="true"
            checked
          />
          {$t("fuel.tankFullDefaultLabel")}
        </label>

        <button
          class="button-primary justify-self-start"
          type="submit"
          disabled={formBusy}
        >
          {$t("fuel.saveDefaultsAction")}
        </button>
      </form>
    {/if}

    <!-- Tab 2: Stations -->
    {#if preferencesTab === "stations"}
      <div class="space-y-4">
        <form
          class="grid gap-3"
          method="POST"
          action="?/saveStation"
          use:enhance={enhanceWithStatus}
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
              <li class="flex items-center justify-between py-2 text-sm">
                <span>{station.name}</span>
                <form
                  method="POST"
                  action="?/deleteStation"
                  use:enhance={enhanceDelete}
                >
                  <input type="hidden" name="id" value={station.id} />
                  <button
                    class="button-danger min-h-11 px-3 py-1 text-xs"
                    disabled={formBusy}
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
          use:enhance={enhanceWithStatus}
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
              <input
                class="field"
                id="grade-type"
                name="fuel_type"
                value="gasoline"
              />
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="field-group">
              <label class="field-label" for="grade-octane">
                {$t("fuel.octaneLabel")}
              </label>
              <input class="field" id="grade-octane" name="octane_rating" />
            </div>
            <div class="field-group">
              <label class="field-label" for="grade-ethanol">
                {$t("fuel.ethanolLabel")}
              </label>
              <input
                class="field"
                id="grade-ethanol"
                name="ethanol_percentage"
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
                  use:enhance={enhanceDelete}
                >
                  <input type="hidden" name="id" value={grade.id} />
                  <button
                    class="button-danger min-h-11 px-3 py-1 text-xs"
                    disabled={formBusy}
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
        use:enhance={enhanceWithStatus}
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
              min="1"
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
