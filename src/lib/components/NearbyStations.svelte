<script lang="ts">
  import { calendarDay } from "$lib/utils/calendar-day";
  import { format, t } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import LocationFields from "./LocationFields.svelte";
  import {
    nearbyStations,
    coordinate,
    type Station,
    type StationFill,
  } from "$lib/domain/nearby-stations";
  export let stations: Station[];
  export let records: StationFill[];
  export let grades: Array<{ id: string; name: string }> = [];
  let latitude = "";
  let longitude = "";
  let radius = 10;
  let fuelType = "";
  const fuelTypeKeys: Record<string, MessageKey> = {
    gasoline: "fuel.typeGasoline",
    ethanol: "fuel.typeEthanol",
    flex: "fuel.typeFlex",
    diesel: "fuel.typeDiesel",
    gnv: "fuel.typeGnv",
  };
  // Coordinates may be typed with a pt-BR decimal comma ("-23,55").
  const decimal = (value: string) => value.trim().replace(",", ".");
  $: fuelTypes = [
    ...new Set(
      records
        .filter((r) => r.fuel_type)
        .map((r) => `${r.fuel_type}::${r.fuel_grade_id ?? ""}`),
    ),
  ].sort();
  $: if (!fuelType && fuelTypes.length) fuelType = fuelTypes[0];
  $: [selectedFuel, selectedGrade] = fuelType.split("::");
  $: lat = decimal(latitude);
  $: lng = decimal(longitude);
  $: ready = coordinate(lat, 90) !== null && coordinate(lng, 180) !== null;
  $: results = ready
    ? nearbyStations(stations, records, {
        latitude: Number(lat),
        longitude: Number(lng),
        radiusKm: radius,
        fuelType: selectedFuel,
        fuelGradeId: selectedGrade,
        today: calendarDay(),
      })
    : [];

  function fuelLabel(fuel: string) {
    const [type, gradeId] = fuel.split("::");
    const typeLabel = Object.hasOwn(fuelTypeKeys, type)
      ? $t(fuelTypeKeys[type])
      : type;
    if (!gradeId) return typeLabel;
    return `${typeLabel} · ${grades.find((g) => g.id === gradeId)?.name ?? gradeId}`;
  }
</script>

<details class="panel p-5">
  <summary class="cursor-pointer font-semibold">{$t("nearby.heading")}</summary>
  <div class="mt-4 grid gap-4">
    <p class="text-sm text-[var(--muted)]">{$t("nearby.help")}</p>
    <LocationFields id="nearby" bind:latitude bind:longitude />
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="field-group">
        <label class="field-label" for="nearby-radius"
          >{$t("nearby.radius")}</label
        >
        <input
          class="field"
          id="nearby-radius"
          type="number"
          inputmode="numeric"
          min="1"
          max="100"
          step="1"
          bind:value={radius}
        />
      </div>
      <div class="field-group">
        <label class="field-label" for="nearby-fuel"
          >{$t("nearby.fuelType")}</label
        >
        <select class="field" id="nearby-fuel" bind:value={fuelType}>
          {#each fuelTypes as fuel}<option value={fuel}
              >{fuelLabel(fuel)}</option
            >{/each}
        </select>
      </div>
    </div>
    {#if ready}
      <ul class="grid gap-3" aria-live="polite">
        {#each results as station}
          <li
            class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
          >
            <div>
              <p class="font-semibold">
                {station.name} ·
                <span class="numeric"
                  >{$format.preciseMoney(station.priceMillicents)}/L</span
                >
              </p>
              <p class="text-sm text-[var(--muted)]">
                <span class="numeric"
                  >{$format.number(station.distanceKm, {
                    maximumFractionDigits: 1,
                  })} km</span
                >
                · {$format.date(station.observedDate)}
              </p>
            </div>
            <a
              class="button-secondary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
              target="_blank"
              rel="noreferrer">{$t("nearby.directions")}</a
            >
          </li>
        {:else}<li class="text-sm text-[var(--muted)]">
            {$t("nearby.empty")}
          </li>{/each}
      </ul>
    {/if}
  </div>
</details>
