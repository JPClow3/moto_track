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
  export let data;
  export let form;

  // Currency stays BRL in every locale — that is what Stripe charges. Only the
  // separators and symbol placement follow the reader. See $lib/i18n.
  const brl = (cents: number) => formatMoney($locale, cents);
  const price = (millicents: number) => formatPreciseMoney($locale, millicents);
  $: ocr = form?.ocr;
  $: defaults = data.preferences[0] ?? {};

  // History filters are client-side on purpose: the load already ships every
  // row, so filtering locally keeps the exploration instant instead of paying
  // a round trip per click.
  let filterMotorcycle = "all";
  let filterStation = "";
  let filterPeriod = "all";
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
    )
      return false;
    if (
      filterStation &&
      !String(row.station_name ?? "")
        .toLowerCase()
        .includes(filterStation.toLowerCase())
    )
      return false;
    if (periodCutoff && String(row.date ?? "") < periodCutoff) return false;
    return true;
  });
  $: motorcycleNameById = new Map(
    data.motorcycles.map((moto: Record<string, unknown>) => [
      String(moto.id),
      String(moto.name),
    ]),
  );

  let offlineMessage = "";
  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

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
</script>

<section class="grid gap-6" aria-busy={formBusy}>
  <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>{$t("nav.fuel")}
      </p>
      <h1 class="display text-4xl">{$t("fuel.pageTitle")}</h1>
      <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        {$t("fuel.pageSubtitle")}
      </p>
    </div>
    <a class="button-secondary" href="/fuel/export.csv"
      >{$t("common.exportCsv")}</a
    >
  </div>

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

  <ConfirmDialog bind:this={confirmDialog} confirmLabel={$t("common.delete")} />

  <div class="grid gap-4 md:grid-cols-4">
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">{$t("fuel.statsSpend")}</p>
      <strong class="text-2xl">{brl(data.summary.totalSpend)}</strong>
    </article>
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">{$t("fuel.statsLiters")}</p>
      <strong class="text-2xl">{data.summary.totalLiters.toFixed(2)}</strong>
    </article>
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">{$t("fuel.statsAverage")}</p>
      <strong class="text-2xl"
        >{data.summary.averageConsumption ?? "—"} km/l</strong
      >
    </article>
    <article class="panel p-4">
      <p class="text-sm text-[var(--muted)]">{$t("fuel.statsCostPerKm")}</p>
      <strong class="text-2xl"
        >{data.summary.costPerKm
          ? brl(data.summary.costPerKm * 100)
          : "—"}</strong
      >
    </article>
  </div>

  <div class="panel p-4">
    <h2 class="display text-xl">{$t("fuel.trendHeading")}</h2>
    <p class="mt-1 text-sm text-[var(--muted)]">{$t("fuel.trendHint")}</p>
    {#if data.consumption.length >= 2}
      <div class="mt-4">
        <TrendChart points={data.consumption} unit="km/L" />
      </div>
    {:else}
      <div
        class="mt-4 rounded border border-dashed border-[var(--line)] p-8 text-center"
      >
        <p class="display text-2xl">{$t("fuel.trendEmpty")}</p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          {$t("fuel.trendEmptyHint")}
        </p>
      </div>
    {/if}
  </div>

  {#if ocr}
    <div class="panel p-4">
      <h2 class="font-semibold">{$t("fuel.ocrFoundTitle")}</h2>
      <p class="mt-2 text-sm text-[var(--muted)]">
        {$t("fuel.litersLabel")}: {ocr.liters ?? "—"} ·
        {$t("fuel.totalPriceLabel")}:
        {ocr.total_price ? brl(ocr.total_price * 100) : "—"} ·
        {$t("fuel.colPricePerLiter")}:
        {ocr.price_per_liter ? price(ocr.price_per_liter * 100000) : "—"}
      </p>
      <p class="mt-2 text-sm text-[var(--muted)]">{$t("fuel.ocrFoundHint")}</p>
    </div>
  {/if}

  {#if form?.previewRows}
    <div class="panel p-4">
      <h2 class="font-semibold">{$t("fuel.importPreviewHeading")}</h2>
      <div class="fuel-table-scroll mt-3 overflow-x-auto">
        <table class="fuel-table w-full text-left text-sm">
          <thead
            ><tr
              ><th>#</th><th>{$t("fuel.colDate")}</th><th>{$t("fuel.colKm")}</th
              ><th>{$t("fuel.colLiters")}</th><th>{$t("fuel.colTotal")}</th><th
                >{$t("common.status")}</th
              ></tr
            ></thead
          >
          <tbody>
            {#each form.previewRows as row}
              <tr class="border-t border-[var(--line)]">
                <td class="py-2" data-label="#">{row.row}</td><td
                  data-label={$t("fuel.colDate")}>{row.data.date}</td
                ><td data-label={$t("fuel.colKm")}>{row.data.odometer_km}</td
                ><td data-label={$t("fuel.colLiters")}>{row.data.liters}</td><td
                  data-label={$t("fuel.colTotal")}
                  >{brl(row.data.total_price_cents)}</td
                >
                <td data-label={$t("common.status")}
                  >{row.errors.length
                    ? row.errors.join(" ")
                    : $t("fuel.statusValid")}</td
                >
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
        <label class="field-label" for="fuel-import-motorcycle"
          >{$t("fuel.motorcycleLabel")}</label
        >
        <select
          class="field max-w-xs"
          id="fuel-import-motorcycle"
          name="motorcycle_id"
        >
          <option value="">{$t("fuel.filterAllMotorcycles")}</option>
          {#each data.motorcycles as moto}<option value={moto.id}
              >{moto.name}</option
            >{/each}
        </select>
        <button class="button-primary" type="submit" disabled={formBusy}
          >{$t("fuel.importConfirmAction")}</button
        >
      </form>
    </div>
  {/if}

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <div class="panel overflow-hidden">
      <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div class="field-group min-w-0 flex-1">
          <label class="field-label" for="fuel-filter-motorcycle"
            >{$t("fuel.motorcycleLabel")}</label
          >
          <select
            class="field"
            id="fuel-filter-motorcycle"
            bind:value={filterMotorcycle}
          >
            <option value="all">{$t("fuel.filterAllMotorcycles")}</option>
            {#each data.motorcycles as moto}<option value={moto.id}
                >{moto.name}</option
              >{/each}
          </select>
        </div>
        <div class="field-group min-w-0 flex-1">
          <label class="field-label" for="fuel-filter-station"
            >{$t("fuel.colStation")}</label
          >
          <input
            class="field"
            id="fuel-filter-station"
            type="search"
            placeholder={$t("fuel.filterStationPlaceholder")}
            bind:value={filterStation}
          />
        </div>
        <div class="field-group min-w-0">
          <label class="field-label" for="fuel-filter-period"
            >{$t("fuel.filterPeriod")}</label
          >
          <select
            class="field"
            id="fuel-filter-period"
            bind:value={filterPeriod}
          >
            <option value="90d">{$t("fuel.period90d")}</option>
            <option value="12m">{$t("fuel.period12m")}</option>
            <option value="all">{$t("fuel.periodAll")}</option>
          </select>
        </div>
      </div>
      <p class="px-4 pb-2 text-xs text-[var(--muted)]" role="status">
        {$t("fuel.resultCount", { count: filteredRows.length })}
      </p>
      <div class="fuel-table-scroll overflow-x-auto">
        <table class="fuel-table w-full text-left text-sm">
          <thead
            class="border-b border-t border-[var(--line)] text-xs uppercase text-[var(--muted)]"
          >
            <tr
              ><th class="px-4 py-3">{$t("fuel.colDate")}</th><th
                >{$t("fuel.motorcycleLabel")}</th
              ><th>{$t("fuel.colKm")}</th><th>{$t("fuel.colLiters")}</th><th
                >{$t("fuel.colTotal")}</th
              ><th>{$t("fuel.colPricePerLiter")}</th><th
                >{$t("fuel.colStation")}</th
              ><th>{$t("fuel.colReceipt")}</th><th>{$t("common.actions")}</th
              ></tr
            >
          </thead>
          <tbody>
            {#each filteredRows as row (row.id)}
              <tr class="border-b border-[var(--line)]">
                <td class="px-4 py-3" data-label={$t("fuel.colDate")}
                  >{row.date}</td
                >
                <td data-label={$t("fuel.motorcycleLabel")}
                  >{motorcycleNameById.get(String(row.motorcycle_id ?? "")) ??
                    "—"}</td
                >
                <td data-label={$t("fuel.colKm")}>{row.odometer_km}</td>
                <td data-label={$t("fuel.colLiters")}
                  >{Number(row.liters).toFixed(3)}</td
                >
                <td data-label={$t("fuel.colTotal")}
                  >{brl(row.total_price_cents)}</td
                >
                <td data-label={$t("fuel.colPricePerLiter")}
                  >{price(row.price_per_liter_millicents)}</td
                >
                <td data-label={$t("fuel.colStation")}
                  >{row.station_name || "—"}</td
                >
                <td data-label={$t("fuel.colReceipt")}>
                  {#if row.receipt_file_key}
                    <a
                      class="text-[var(--accent)] underline-offset-2 hover:underline"
                      href={privateFileUrl(String(row.receipt_file_key))}
                      target="_blank"
                      rel="noopener noreferrer">{$t("common.openFile")}</a
                    >
                  {:else}
                    —
                  {/if}
                </td>
                <td class="fuel-actions" data-label={$t("common.actions")}>
                  <form
                    method="POST"
                    action="?/deleteRecord"
                    use:enhance={enhanceDelete}
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      class="button-danger min-h-11 px-3 py-1 text-xs"
                      type="submit"
                      disabled={formBusy}>{$t("common.delete")}</button
                    >
                  </form>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="9" class="px-4 py-12 text-center">
                  <p class="display text-2xl">{$t("fuel.emptyRecords")}</p>
                  <p class="mt-2 text-sm text-[var(--muted)]">
                    {data.rows.length > 0
                      ? $t("fuel.filterEmptyHint")
                      : $t("fuel.emptyRecordsHint")}
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
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/createRecord"
        enctype="multipart/form-data"
        use:enhance={handleCreateRecord}
      >
        <h2 class="display text-xl">{$t("fuel.newRecordTitle")}</h2>
        <label class="field-label" for="fuel-motorcycle"
          >{$t("fuel.motorcycleLabel")}</label
        >
        <select class="field" id="fuel-motorcycle" name="motorcycle_id"
          ><option value="">{$t("fuel.motorcycleLabel")}</option
          >{#each data.motorcycles as moto}<option
              value={moto.id}
              selected={defaults.motorcycle_id === moto.id}>{moto.name}</option
            >{/each}</select
        >
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="fuel-date"
              >{$t("fuel.dateLabel")}</label
            >
            <input
              class="field"
              id="fuel-date"
              type="date"
              name="date"
              value={ocr?.date ?? ""}
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="fuel-odometer"
              >{$t("fuel.odometerLabel")}</label
            >
            <input
              class="field"
              id="fuel-odometer"
              type="number"
              name="odometer_km"
              required
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="fuel-liters"
              >{$t("fuel.litersLabel")}</label
            >
            <input
              class="field"
              id="fuel-liters"
              type="number"
              step="0.001"
              name="liters"
              value={ocr?.liters ?? ""}
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="fuel-total-price"
              >{$t("fuel.totalPriceLabel")}</label
            >
            <input
              class="field"
              id="fuel-total-price"
              type="number"
              step="0.01"
              name="total_price"
              value={ocr?.total_price ?? ""}
              required
            />
          </div>
        </div>
        <label class="field-label" for="fuel-price-per-liter"
          >{$t("fuel.pricePerLiterLabel")}</label
        >
        <input
          class="field"
          id="fuel-price-per-liter"
          type="number"
          step="0.001"
          name="price_per_liter"
          value={ocr?.price_per_liter ??
            (defaults.price_per_liter_millicents
              ? defaults.price_per_liter_millicents / 100000
              : "")}
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="fuel-station"
              >{$t("fuel.stationSavedLabel")}</label
            >
            <select class="field" id="fuel-station" name="station_id"
              ><option value="">{$t("fuel.stationSavedLabel")}</option
              >{#each data.stations as station}<option
                  value={station.id}
                  selected={defaults.station_id === station.id}
                  >{station.name}</option
                >{/each}</select
            >
          </div>
          <div class="field-group">
            <label class="field-label" for="fuel-grade"
              >{$t("fuel.gradeSavedLabel")}</label
            >
            <select class="field" id="fuel-grade" name="fuel_grade_id"
              ><option value="">{$t("fuel.gradeSavedLabel")}</option
              >{#each data.grades as grade}<option
                  value={grade.id}
                  selected={defaults.fuel_grade_id === grade.id}
                  >{grade.name}</option
                >{/each}</select
            >
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="fuel-station-name"
              >{$t("fuel.stationNameLabel")}</label
            >
            <input
              class="field"
              id="fuel-station-name"
              name="station_name"
              value={defaults.station_name ?? ""}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="fuel-type"
              >{$t("fuel.fuelTypeLabel")}</label
            >
            <input
              class="field"
              id="fuel-type"
              name="fuel_type"
              value={defaults.fuel_type ?? "gasoline"}
            />
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm" for="fuel-tank-full"
          ><input
            id="fuel-tank-full"
            type="checkbox"
            name="tank_full"
            value="true"
            checked={defaults.tank_full ?? true}
          />
          {$t("fuel.tankFullLabel")}</label
        >
        <label class="field-label" for="fuel-notes"
          >{$t("fuel.notesLabel")}</label
        >
        <textarea class="field" id="fuel-notes" name="notes"></textarea>
        <label class="field-label" for="fuel-receipt"
          >{$t("fuel.receiptLabel")}</label
        >
        <input
          class="field"
          id="fuel-receipt"
          type="file"
          name="receipt_file"
          accept="image/*,.pdf,.txt"
        />
        <button class="button-primary" type="submit" disabled={formBusy}
          >{$t("common.save")}</button
        >
      </form>

      <details class="panel p-4">
        <summary class="display cursor-pointer text-lg"
          >{$t("fuel.repeatTitle")}</summary
        >
        <form
          class="mt-3 grid gap-3"
          method="POST"
          action="?/repeatLast"
          use:enhance={enhanceWithStatus}
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="fuel-repeat-date"
                >{$t("fuel.dateLabel")}</label
              >
              <input
                class="field"
                id="fuel-repeat-date"
                type="date"
                name="date"
                required
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="fuel-repeat-odometer"
                >{$t("fuel.newOdometerLabel")}</label
              >
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
              <label class="field-label" for="fuel-repeat-liters"
                >{$t("fuel.litersLabel")}</label
              >
              <input
                class="field"
                id="fuel-repeat-liters"
                type="number"
                step="0.001"
                name="liters"
                required
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="fuel-repeat-total"
                >{$t("fuel.totalPriceLabel")}</label
              >
              <input
                class="field"
                id="fuel-repeat-total"
                type="number"
                step="0.01"
                name="total_price"
                required
              />
            </div>
          </div>
          <button
            class="button-secondary justify-self-start"
            type="submit"
            disabled={formBusy}>{$t("fuel.repeatAction")}</button
          >
        </form>
      </details>

      <details class="panel p-4">
        <summary class="display cursor-pointer text-lg"
          >{$t("fuel.ocrTitle")}</summary
        >
        <form
          class="mt-3 grid gap-3"
          method="POST"
          action="?/ocrScan"
          enctype="multipart/form-data"
          use:enhance={enhanceWithStatus}
        >
          <label class="field-label" for="fuel-ocr-file"
            >{$t("fuel.receiptLabel")}</label
          >
          <input
            class="field"
            id="fuel-ocr-file"
            type="file"
            name="receipt_file"
            accept="image/*,.pdf,.txt"
            required
          />
          <button
            class="button-secondary justify-self-start"
            type="submit"
            disabled={formBusy}>{$t("fuel.ocrScanAction")}</button
          >
        </form>
      </details>
    </div>
  </div>

  <details class="panel p-5">
    <summary class="display cursor-pointer text-xl">
      {$t("fuel.toolsHeading")}
      <span class="block text-sm font-normal text-[var(--muted)]"
        >{$t("fuel.toolsSummary")}</span
      >
    </summary>
    <div class="mt-5 grid gap-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <form
          class="grid gap-3"
          method="POST"
          action="?/importPreview"
          enctype="multipart/form-data"
          use:enhance={enhanceWithStatus}
        >
          <h3 class="font-bold">{$t("fuel.importTitle")}</h3>
          <p class="text-sm text-[var(--muted)]" id="fuel-csv-help">
            {$t("fuel.csvHelp")}
          </p>
          <label class="field-label" for="fuel-csv-file">CSV</label>
          <input
            class="field"
            id="fuel-csv-file"
            type="file"
            name="csv_file"
            accept=".csv,text/csv"
            aria-describedby="fuel-csv-help"
            required
          />
          <button
            class="button-secondary justify-self-start"
            type="submit"
            disabled={formBusy}>{$t("fuel.importPreviewAction")}</button
          >
        </form>

        <form
          class="grid gap-3"
          method="POST"
          action="?/saveDefaults"
          use:enhance={enhanceWithStatus}
        >
          <h3 class="font-bold">{$t("fuel.defaultsTitle")}</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="defaults-motorcycle"
                >{$t("fuel.motorcycleLabel")}</label
              >
              <select
                class="field"
                id="defaults-motorcycle"
                name="motorcycle_id"
                ><option value="">{$t("fuel.motorcycleLabel")}</option
                >{#each data.motorcycles as moto}<option value={moto.id}
                    >{moto.name}</option
                  >{/each}</select
              >
              <label class="field-label" for="defaults-station"
                >{$t("fuel.stationSavedLabel")}</label
              >
              <select class="field" id="defaults-station" name="station_id"
                ><option value="">{$t("fuel.stationSavedLabel")}</option
                >{#each data.stations as station}<option value={station.id}
                    >{station.name}</option
                  >{/each}</select
              >
            </div>
            <div class="field-group">
              <label class="field-label" for="defaults-grade"
                >{$t("fuel.gradeSavedLabel")}</label
              >
              <select class="field" id="defaults-grade" name="fuel_grade_id"
                ><option value="">{$t("fuel.gradeSavedLabel")}</option
                >{#each data.grades as grade}<option value={grade.id}
                    >{grade.name}</option
                  >{/each}</select
              >
              <label class="field-label" for="defaults-price"
                >{$t("fuel.pricePerLiterLabel")}</label
              >
              <input class="field" id="defaults-price" name="price_per_liter" />
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="defaults-station-name"
                >{$t("fuel.stationAnyLabel")}</label
              >
              <input
                class="field"
                id="defaults-station-name"
                name="station_name"
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="defaults-fuel-type"
                >{$t("fuel.fuelTypeLabel")}</label
              >
              <input
                class="field"
                id="defaults-fuel-type"
                name="fuel_type"
                value="gasoline"
              />
            </div>
          </div>
          <label
            class="flex items-center gap-2 text-sm"
            for="defaults-tank-full"
            ><input
              id="defaults-tank-full"
              type="checkbox"
              name="tank_full"
              value="true"
              checked
            />
            {$t("fuel.tankFullDefaultLabel")}</label
          >
          <button
            class="button-secondary justify-self-start"
            type="submit"
            disabled={formBusy}>{$t("fuel.saveDefaultsAction")}</button
          >
        </form>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="rounded border border-[var(--line)] p-4">
          <h3 class="font-bold">{$t("fuel.stationsHeading")}</h3>
          <form
            class="mt-3 grid gap-3"
            method="POST"
            action="?/saveStation"
            use:enhance={enhanceWithStatus}
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="field-group">
                <label class="field-label" for="station-name"
                  >{$t("fuel.nameLabel")}</label
                >
                <input class="field" id="station-name" name="name" required />
              </div>
              <div class="field-group">
                <label class="field-label" for="station-brand"
                  >{$t("fuel.brandLabel")}</label
                >
                <input class="field" id="station-brand" name="brand" />
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="field-group">
                <label class="field-label" for="station-city"
                  >{$t("fuel.cityLabel")}</label
                >
                <input class="field" id="station-city" name="city" />
              </div>
              <div class="field-group">
                <label class="field-label" for="station-state"
                  >{$t("fuel.stateLabel")}</label
                >
                <input class="field" id="station-state" name="state" />
              </div>
            </div>
            <label class="field-label" for="station-notes"
              >{$t("fuel.notesLabel")}</label
            >
            <textarea class="field" id="station-notes" name="notes"></textarea>
            <button
              class="button-secondary justify-self-start"
              type="submit"
              disabled={formBusy}>{$t("fuel.saveStationAction")}</button
            >
          </form>
          <ul class="mt-4 grid gap-2">
            {#each data.stations as station (station.id)}
              <li
                class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"
              >
                <span>{station.name}</span>
                <form
                  method="POST"
                  action="?/deleteStation"
                  use:enhance={enhanceDelete}
                >
                  <input type="hidden" name="id" value={station.id} /><button
                    class="button-danger min-h-11 px-3 py-1 text-xs"
                    disabled={formBusy}>{$t("common.delete")}</button
                  >
                </form>
              </li>
            {:else}
              <li class="text-sm text-[var(--muted)]">—</li>
            {/each}
          </ul>
        </div>

        <div class="rounded border border-[var(--line)] p-4">
          <h3 class="font-bold">{$t("fuel.gradesHeading")}</h3>
          <form
            class="mt-3 grid gap-3"
            method="POST"
            action="?/saveGrade"
            use:enhance={enhanceWithStatus}
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="field-group">
                <label class="field-label" for="grade-name"
                  >{$t("fuel.nameLabel")}</label
                >
                <input class="field" id="grade-name" name="name" required />
              </div>
              <div class="field-group">
                <label class="field-label" for="grade-type"
                  >{$t("fuel.fuelTypeLabel")}</label
                >
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
                <label class="field-label" for="grade-octane"
                  >{$t("fuel.octaneLabel")}</label
                >
                <input class="field" id="grade-octane" name="octane_rating" />
              </div>
              <div class="field-group">
                <label class="field-label" for="grade-ethanol"
                  >{$t("fuel.ethanolLabel")}</label
                >
                <input
                  class="field"
                  id="grade-ethanol"
                  name="ethanol_percentage"
                />
              </div>
              <div class="field-group">
                <label class="field-label" for="grade-price"
                  >{$t("fuel.defaultPriceLabel")}</label
                >
                <input
                  class="field"
                  id="grade-price"
                  name="default_price_per_liter"
                />
              </div>
            </div>
            <label class="field-label" for="grade-notes"
              >{$t("fuel.notesLabel")}</label
            >
            <textarea class="field" id="grade-notes" name="notes"></textarea>
            <button
              class="button-secondary justify-self-start"
              type="submit"
              disabled={formBusy}>{$t("fuel.saveGradeAction")}</button
            >
          </form>
          <ul class="mt-4 grid gap-2">
            {#each data.grades as grade (grade.id)}
              <li
                class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"
              >
                <span>{grade.name}</span>
                <form
                  method="POST"
                  action="?/deleteGrade"
                  use:enhance={enhanceDelete}
                >
                  <input type="hidden" name="id" value={grade.id} /><button
                    class="button-danger min-h-11 px-3 py-1 text-xs"
                    disabled={formBusy}>{$t("common.delete")}</button
                  >
                </form>
              </li>
            {:else}
              <li class="text-sm text-[var(--muted)]">—</li>
            {/each}
          </ul>
        </div>
      </div>

      <form
        class="grid gap-3 border-t border-[var(--line)] pt-5"
        method="POST"
        action="?/saveReviewSettings"
        use:enhance={enhanceWithStatus}
      >
        <h3 class="font-bold">{$t("fuel.reviewTitle")}</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="review-motorcycle"
              >{$t("fuel.motorcycleLabel")}</label
            >
            <select
              class="field"
              id="review-motorcycle"
              name="motorcycle_id"
              required
              ><option value="">{$t("fuel.motorcycleLabel")}</option
              >{#each data.motorcycles as moto}<option value={moto.id}
                  >{moto.name}</option
                >{/each}</select
            >
          </div>
          <div class="field-group">
            <label class="field-label" for="review-interval"
              >{$t("fuel.reviewIntervalLabel")}</label
            >
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
        <label class="flex items-center gap-2 text-sm" for="review-active"
          ><input
            id="review-active"
            type="checkbox"
            name="is_active"
            value="true"
            checked
          />
          {$t("fuel.reviewActiveLabel")}</label
        >
        <button
          class="button-secondary justify-self-start"
          type="submit"
          disabled={formBusy}>{$t("fuel.saveReviewAction")}</button
        >
      </form>
    </div>
  </details>
</section>

<style>
  @media (max-width: 1279px) {
    .fuel-table-scroll {
      overflow-x: visible;
    }

    .fuel-table {
      min-width: 0;
      border-collapse: separate;
      border-spacing: 0 0.75rem;
    }

    .fuel-table thead {
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

    .fuel-table tbody {
      display: grid;
      gap: 0.75rem;
    }

    .fuel-table tbody tr {
      display: block;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--panel);
    }

    .fuel-table tbody tr td {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
      border-bottom: 1px solid var(--line);
      padding: 0.75rem 1rem;
    }

    .fuel-table tbody tr td::before {
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

    .fuel-table tbody tr td > * {
      min-width: 0;
      max-width: 64%;
      overflow-wrap: anywhere;
    }

    .fuel-table tbody tr td:last-child {
      border-bottom: 0;
    }

    .fuel-table tbody tr td.fuel-actions {
      display: block;
    }

    .fuel-table tbody tr td.fuel-actions::before {
      display: block;
      margin-bottom: 0.65rem;
    }

    .fuel-table tbody tr td.fuel-actions > form {
      max-width: none;
    }
  }

  @media (min-width: 1280px) {
    .fuel-table {
      min-width: 900px;
    }
  }
</style>
