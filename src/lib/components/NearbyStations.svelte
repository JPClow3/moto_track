<script lang="ts">
  import { format, t } from "$lib/i18n/store";
  import LocationFields from "./LocationFields.svelte";
  import {
    nearbyStations,
    coordinate,
    type Station,
    type StationFill,
  } from "$lib/domain/nearby-stations";
  let {
    stations,
    records,
    grades = [],
  }: {
    stations: Station[];
    records: StationFill[];
    grades?: Array<{ id: string; name: string }>;
  } = $props();
  let latitude = $state("");
  let longitude = $state("");
  let radius = $state(10);
  let fuelTypeChoice = $state("");
  let fuelTypes = $derived(
    [
      ...new Set(
        records
          .filter((r) => r.fuel_type)
          .map((r) => `${r.fuel_type}::${r.fuel_grade_id ?? ""}`),
      ),
    ].sort(),
  );
  let fuelType = $derived(fuelTypeChoice || fuelTypes[0] || "");
  let selectedFuel = $derived(fuelType.split("::")[0]);
  let selectedGrade = $derived(fuelType.split("::")[1]);
  let ready = $derived(
    coordinate(latitude, 90) !== null && coordinate(longitude, 180) !== null,
  );
  let results = $derived(
    ready
      ? nearbyStations(stations, records, {
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusKm: radius,
          fuelType: selectedFuel,
          fuelGradeId: selectedGrade,
          today: new Date().toISOString().slice(0, 10),
        })
      : [],
  );
</script>

<section class="panel grid gap-4 p-5" aria-labelledby="nearby-heading">
  <h2 class="display text-xl" id="nearby-heading">{$t("nearby.heading")}</h2>
  <p class="text-sm text-[var(--muted)]">{$t("nearby.help")}</p>
  <LocationFields id="nearby" bind:latitude bind:longitude />
  <div class="grid gap-3 sm:grid-cols-2">
    <label class="field-group" for="nearby-radius"
      ><span class="field-label">{$t("nearby.radius")}</span><input
        class="field"
        id="nearby-radius"
        type="number"
        min="1"
        max="100"
        bind:value={radius}
      /></label
    >
    <label class="field-group" for="nearby-fuel"
      ><span class="field-label">{$t("nearby.fuelType")}</span><select
        class="field"
        id="nearby-fuel"
        value={fuelType}
        onchange={(event) => {
          fuelTypeChoice = event.currentTarget.value;
        }}
      >
        {#each fuelTypes as fuel (fuel)}<option value={fuel}
            >{fuel.split("::")[0]}{fuel.split("::")[1]
              ? ` · ${grades.find((g) => g.id === fuel.split("::")[1])?.name ?? fuel.split("::")[1]}`
              : ""}</option
          >{/each}
      </select></label
    >
  </div>
  {#if ready}
    <ul class="grid gap-3" aria-live="polite">
      {#each results as station (`${station.name}:${station.latitude}:${station.longitude}`)}
        <li
          class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
        >
          <div>
            <p class="font-semibold">
              {station.name} · {$format.preciseMoney(station.priceMillicents)}/L
            </p>
            <p class="text-sm text-[var(--muted)]">
              {$format.number(station.distanceKm, {
                maximumFractionDigits: 1,
              })} km · {$format.date(station.observedDate)}
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
  {:else}
    <p class="text-sm text-[var(--muted)]">{$t("nearby.needLocation")}</p>
  {/if}
</section>
