<script context="module" lang="ts">
  export type FuelFieldValues = {
    motorcycle_id?: string;
    date?: string;
    odometer_km?: string;
    liters?: string;
    total_price?: string;
    station_name?: string;
    fuel_grade_id?: string;
    fuel_type?: string;
    tank_full?: boolean;
    notes?: string;
  };
</script>

<script lang="ts">
  import { locale, t, format } from "$lib/i18n/store";
  import { formatPreciseMoney } from "$lib/i18n";
  import { calendarDay } from "$lib/utils/calendar-day";

  type Row = Record<string, unknown>;

  /** Prefix for element ids, so several forms can live on one page. */
  export let idPrefix: string;
  export let motorcycles: Row[] = [];
  export let stations: Row[] = [];
  export let grades: Row[] = [];
  export let initial: FuelFieldValues = {};
  /** Shown as the odometer placeholder: the last reading for this bike. */
  export let odometerHint: unknown = null;
  export let showReceipt = true;
  /** Offer "no bike", for editing fill-ups that were never linked to one. */
  export let allowUnassigned = false;

  // Decimal fields are text inputs (pt-BR riders type "4,59"); the server
  // parses both marks. Accepts "4,59", "4.59", "1.234,56" and "1,234.56".
  const DECIMAL_PATTERN = "[0-9]+([.,][0-9]{3})*([.,][0-9]+)?";
  const FUEL_TYPES = ["gasoline", "ethanol", "flex", "diesel", "gnv"] as const;
  const FUEL_TYPE_KEY = {
    gasoline: "fuel.typeGasoline",
    ethanol: "fuel.typeEthanol",
    flex: "fuel.typeFlex",
    diesel: "fuel.typeDiesel",
    gnv: "fuel.typeGnv",
  } as const;

  let motorcycleId = initial.motorcycle_id ?? String(motorcycles[0]?.id ?? "");
  let date = initial.date || calendarDay();
  let liters = initial.liters ?? "";
  let total = initial.total_price ?? "";
  let stationName = initial.station_name ?? "";
  let tankFull = initial.tank_full ?? true;
  let editContext = false;

  // Saved grades and plain fuel types are one choice for the rider; the form
  // still posts both columns the server stores.
  let fuelChoice = initial.fuel_grade_id
    ? `grade:${initial.fuel_grade_id}`
    : `type:${initial.fuel_type || "gasoline"}`;
  $: chosenGrade = fuelChoice.startsWith("grade:")
    ? grades.find((grade) => `grade:${grade.id}` === fuelChoice)
    : undefined;
  $: fuelGradeId = chosenGrade ? String(chosenGrade.id) : "";
  $: fuelType = chosenGrade
    ? String(chosenGrade.fuel_type ?? "gasoline")
    : fuelChoice.slice("type:".length);

  // One station field: typing a saved station's name links the record to it.
  $: stationId =
    stations.find(
      (station) =>
        String(station.name ?? "")
          .trim()
          .toLocaleLowerCase() === stationName.trim().toLocaleLowerCase(),
    )?.id ?? "";
  $: stationChips = stations.slice(0, 6);

  /** Display-only parse; the server owns the real one. */
  function parseDecimal(value: string): number | null {
    const raw = value.trim().replace(/\s/g, "");
    if (!raw) return null;
    const mark = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
    const normalised =
      mark === ","
        ? raw.replaceAll(".", "").replace(",", ".")
        : raw.replaceAll(",", "");
    const number = Number(normalised);
    return Number.isFinite(number) ? number : null;
  }

  $: litersValue = parseDecimal(liters);
  $: totalValue = parseDecimal(total);
  $: pricePerLiter =
    litersValue && totalValue !== null && litersValue > 0
      ? formatPreciseMoney(
          $locale,
          Math.round((totalValue / litersValue) * 100000),
        )
      : "";

  // A record of an archived bike has an id the active-bike list lacks; it
  // keeps that bike as an option so saving an edit can't drop the link.
  const unlistedId =
    initial.motorcycle_id &&
    !motorcycles.some((moto) => String(moto.id) === initial.motorcycle_id)
      ? initial.motorcycle_id
      : "";
  $: bikeName = !motorcycleId
    ? $t("fuelUx.noBike")
    : motorcycleId === unlistedId
      ? $t("fuelUx.archivedBike")
      : String(
          motorcycles.find((moto) => String(moto.id) === motorcycleId)?.name ??
            "",
        );
  // Only a YYYY-MM-DD value is formatted; anything else would make the
  // formatter throw "Invalid time value".
  $: dateLabel =
    date === calendarDay()
      ? $t("fuelUx.today")
      : /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? $format.date(`${date}T00:00:00.000Z`, {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          })
        : date;
</script>

<!-- Bike and date are almost always "this bike, today": a chip, tap to change. -->
<button
  type="button"
  class="focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded border border-[var(--line)] bg-[var(--panel-sunken)] px-3 text-left text-sm"
  aria-expanded={editContext}
  aria-controls={`${idPrefix}-context`}
  on:click={() => (editContext = !editContext)}
>
  <span class="min-w-0 truncate">
    <span class="font-semibold text-[var(--fg)]">{bikeName}</span>
    <span class="text-[var(--muted)]"> · {dateLabel}</span>
  </span>
  <span class="shrink-0 font-semibold text-[var(--fg)] underline">
    {editContext ? $t("common.done") : $t("fuelUx.change")}
  </span>
</button>

<div
  id={`${idPrefix}-context`}
  class="grid gap-3 sm:grid-cols-2"
  class:hidden={!editContext && Boolean(date)}
>
  <div class="field-group">
    <label class="field-label" for={`${idPrefix}-motorcycle`}>
      {$t("fuel.motorcycleLabel")}
    </label>
    <select
      class="field"
      id={`${idPrefix}-motorcycle`}
      name="motorcycle_id"
      bind:value={motorcycleId}
    >
      {#if allowUnassigned || !motorcycleId}
        <option value="">{$t("fuelUx.noBike")}</option>
      {/if}
      {#if unlistedId}
        <option value={unlistedId}>{$t("fuelUx.archivedBike")}</option>
      {/if}
      {#each motorcycles as moto (moto.id)}
        <option value={String(moto.id)}>{moto.name}</option>
      {/each}
    </select>
  </div>
  <div class="field-group">
    <label class="field-label" for={`${idPrefix}-date`}>
      {$t("fuel.dateLabel")}
    </label>
    <input
      class="field"
      id={`${idPrefix}-date`}
      type="date"
      name="date"
      bind:value={date}
      on:invalid={() => (editContext = true)}
      required
    />
  </div>
</div>

<div class="field-group">
  <label class="field-label" for={`${idPrefix}-odometer`}>
    {$t("fuel.odometerLabel")} (km)
  </label>
  <input
    class="field"
    id={`${idPrefix}-odometer`}
    type="number"
    inputmode="numeric"
    min="0"
    step="1"
    name="odometer_km"
    value={initial.odometer_km ?? ""}
    placeholder={odometerHint != null ? String(odometerHint) : ""}
    required
  />
</div>

<div class="grid grid-cols-2 gap-3">
  <div class="field-group">
    <label class="field-label" for={`${idPrefix}-liters`}>
      {$t("fuel.litersLabel")}
    </label>
    <input
      class="field"
      id={`${idPrefix}-liters`}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      pattern={DECIMAL_PATTERN}
      title={$t("fuelUx.decimalHint")}
      placeholder={$t("fuelUx.litersPlaceholder")}
      name="liters"
      bind:value={liters}
      required
    />
  </div>
  <div class="field-group">
    <label class="field-label" for={`${idPrefix}-total-price`}>
      {$t("fuel.totalPriceLabel")}
    </label>
    <input
      class="field"
      id={`${idPrefix}-total-price`}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      pattern={DECIMAL_PATTERN}
      title={$t("fuelUx.decimalHint")}
      placeholder={$t("fuelUx.moneyPlaceholder")}
      name="total_price"
      bind:value={total}
      required
    />
  </div>
</div>

<p class="numeric -mt-1 min-h-5 text-sm text-[var(--muted)]" aria-live="polite">
  {#if pricePerLiter}
    {$t("fuelUx.pricePerLiterComputed", { price: pricePerLiter })}
  {/if}
</p>

<input type="hidden" name="station_id" value={stationId} />
<input type="hidden" name="fuel_grade_id" value={fuelGradeId} />
<input type="hidden" name="fuel_type" value={fuelType} />

<details class="group/more rounded border border-[var(--line)]">
  <summary
    class="focus-ring flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded px-3 text-sm font-semibold"
  >
    {$t("fuelUx.moreDetails")}
    <span class="text-xs font-normal text-[var(--muted)]">
      {$t("fuelUx.moreDetailsHint")}
    </span>
  </summary>

  <div class="grid gap-3 border-t border-[var(--line)] p-3">
    <div class="field-group">
      <label class="field-label" for={`${idPrefix}-station`}>
        {$t("fuelUx.stationLabel")}
      </label>
      <input
        class="field"
        id={`${idPrefix}-station`}
        name="station_name"
        autocomplete="off"
        bind:value={stationName}
      />
      {#if stationChips.length}
        <div class="mt-1 flex flex-wrap gap-2">
          {#each stationChips as station (station.id)}
            {@const name = String(station.name ?? "")}
            <button
              type="button"
              class="focus-ring min-h-11 rounded-full border px-3 text-sm {stationId ===
              station.id
                ? 'border-[var(--fg)] font-semibold text-[var(--fg)]'
                : 'border-[var(--line)] text-[var(--muted)]'}"
              aria-pressed={stationId === station.id}
              on:click={() => (stationName = name)}
            >
              {name}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="field-group">
      <label class="field-label" for={`${idPrefix}-fuel`}>
        {$t("fuelUx.fuelLabel")}
      </label>
      <select class="field" id={`${idPrefix}-fuel`} bind:value={fuelChoice}>
        {#each grades as grade (grade.id)}
          <option value={`grade:${grade.id}`}>{grade.name}</option>
        {/each}
        {#each FUEL_TYPES as type (type)}
          <option value={`type:${type}`}>{$t(FUEL_TYPE_KEY[type])}</option>
        {/each}
      </select>
    </div>

    <label class="flex min-h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        name="tank_full"
        value="true"
        bind:checked={tankFull}
      />
      {$t("fuel.tankFullLabel")}
    </label>

    <div class="field-group">
      <label class="field-label" for={`${idPrefix}-notes`}>
        {$t("fuel.notesLabel")}
      </label>
      <textarea
        class="field min-h-16"
        id={`${idPrefix}-notes`}
        name="notes"
        value={initial.notes ?? ""}
      ></textarea>
    </div>

    {#if showReceipt}
      <div class="field-group">
        <label class="field-label" for={`${idPrefix}-receipt`}>
          {$t("fuel.receiptLabel")}
        </label>
        <input
          class="field"
          id={`${idPrefix}-receipt`}
          type="file"
          name="receipt_file"
          accept="image/*,.pdf,.txt"
        />
      </div>
    {/if}
  </div>
</details>
