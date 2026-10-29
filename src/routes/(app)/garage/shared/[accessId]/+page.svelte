<script lang="ts">
  import { calendarDay } from "$lib/utils/calendar-day";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { format, t } from "$lib/i18n/store";
  import PageHeader from "$components/app/PageHeader.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import { showToast } from "$components/ui/toast";
  import { Motorcycle } from "$components/icons";
  export let data;
  export let form;
  let feature = "maintenance";
  let busy = false;
  const bikeName = (id: string) =>
    data.motorcycles.find(
      (bike: { id: string; name: string }) => bike.id === id,
    )?.name ?? "";
  const recordEnhance: SubmitFunction = () => {
    busy = true;
    return async ({ result, update }) => {
      busy = false;
      await update();
      if (result.type === "success") showToast($t("garageUx.recordSaved"));
    };
  };
  const thClass = "label-tech px-4 py-2 font-semibold text-[var(--muted)]";
  const tdClass = "px-4 py-3";
</script>

<svelte:head><title>{$t("sharing.heading")} · Moto Track</title></svelte:head>
<div class="grid gap-6">
  <PageHeader
    title={$t("sharing.heading")}
    description={$t("sharing.rolesHelp")}
  >
    <svelte:fragment slot="actions"
      ><a class="button-secondary" href="/garage/access"
        >{$t("sharing.manage")}</a
      ></svelte:fragment
    >
  </PageHeader>
  {#if form?.message}<p
      class="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]"
      role="alert"
    >
      {form.message}
    </p>{/if}
  {#if data.motorcycles.length}
    <section
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label={$t("nav.garage")}
    >
      {#each data.motorcycles as bike (bike.id)}
        <article class="panel p-5">
          <div class="flex items-start gap-4">
            <span
              class="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[var(--panel-sunken)] text-[var(--fg-soft)]"
              aria-hidden="true"
            >
              <Motorcycle size={24} />
            </span>
            <div class="min-w-0">
              <h2 class="display break-words text-2xl">{bike.name}</h2>
              <p class="mt-0.5 text-sm text-[var(--muted)]">
                {bike.brand}
                {bike.model} · {bike.year}
              </p>
            </div>
          </div>
          <p class="label-tech mt-5 text-[var(--muted)]">
            {$t("garageUx.odometer")}
          </p>
          <p class="display numeric mt-1 text-[2.75rem] leading-none">
            {$format.number(Number(bike.current_odometer_km ?? 0))}
            <span class="text-base font-medium text-[var(--muted)]"
              >{$t("garage.distanceUnit")}</span
            >
          </p>
        </article>
      {/each}
    </section>
  {:else}
    <EmptyState compact icon={Motorcycle} title={$t("sharing.noBikes")} />
  {/if}
  {#if data.role !== "viewer" && data.motorcycles.length}
    <section class="panel grid gap-4 p-5" aria-labelledby="shared-create">
      <div>
        <h2 class="display text-xl" id="shared-create">
          {$t("sharing.addRecord")}
        </h2>
        <p class="mt-1 text-sm text-[var(--muted)]">
          {$t("sharing.recordHelp")}
        </p>
      </div>
      <form
        class="grid gap-4"
        method="POST"
        action="?/record"
        use:enhance={recordEnhance}
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="field-group" for="shared-feature"
            ><span class="field-label">{$t("sharing.recordType")}</span><select
              class="field"
              id="shared-feature"
              name="feature"
              bind:value={feature}
              ><option value="maintenance">{$t("nav.maintenance")}</option
              >{#if data.role === "contributor"}<option value="fuel"
                  >{$t("nav.fuel")}</option
                >{/if}</select
            ></label
          >
          <label class="field-group" for="shared-bike"
            ><span class="field-label">{$t("nav.garage")}</span><select
              class="field"
              id="shared-bike"
              name="motorcycle_id"
              required
              >{#each data.motorcycles as bike (bike.id)}<option value={bike.id}
                  >{bike.name}</option
                >{/each}</select
            ></label
          >
          <label class="field-group" for="shared-date"
            ><span class="field-label">{$t("sharing.date")}</span><input
              class="field"
              id="shared-date"
              name="date"
              type="date"
              value={calendarDay()}
              max={calendarDay()}
              required
            /></label
          >
          <label class="field-group" for="shared-mileage"
            ><span class="field-label">{$t("garage.currentOdometer")}</span
            ><input
              class="field"
              id="shared-mileage"
              name="odometer_km"
              type="number"
              inputmode="numeric"
              min="0"
              max="2147483647"
              step="1"
              required
            /></label
          >
        </div>
        {#if feature === "maintenance"}
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="field-group" for="shared-service"
              ><span class="field-label"
                >{$t("maintenance.maintenanceType")}</span
              ><input
                class="field"
                id="shared-service"
                name="maintenance_type"
                maxlength="120"
                required
              /></label
            >
            <label class="field-group" for="shared-workshop"
              ><span class="field-label">{$t("sharing.workshop")}</span><input
                class="field"
                id="shared-workshop"
                name="workshop"
                maxlength="160"
              /></label
            >
            <label class="field-group" for="shared-cost"
              ><span class="field-label">{$t("sharing.cost")}</span><input
                class="field"
                id="shared-cost"
                name="cost_cents"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                placeholder="0,00"
                required
              /></label
            >
          </div>
          <label class="field-group" for="shared-description"
            ><span class="field-label">{$t("sharing.description")}</span
            ><textarea
              class="field"
              id="shared-description"
              name="description"
              maxlength="2000"
            ></textarea></label
          >
        {:else}
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="field-group" for="shared-liters"
              ><span class="field-label">{$t("fuel.litersLabel")}</span><input
                class="field"
                id="shared-liters"
                name="liters"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                placeholder="0,000"
                required
              /></label
            >
            <label class="field-group" for="shared-total"
              ><span class="field-label">{$t("fuel.totalPriceLabel")}</span
              ><input
                class="field"
                id="shared-total"
                name="total_price_cents"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                placeholder="0,00"
                required
              /></label
            >
            <label class="field-group" for="shared-fuel"
              ><span class="field-label">{$t("fuel.fuelTypeLabel")}</span
              ><select class="field" id="shared-fuel" name="fuel_type"
                ><option value="gasoline">{$t("sharing.gasoline")}</option
                ><option value="ethanol">{$t("sharing.ethanol")}</option
                ></select
              ></label
            >
            <label class="field-group" for="shared-station"
              ><span class="field-label">{$t("sharing.station")}</span><input
                class="field"
                id="shared-station"
                name="station_name"
                maxlength="160"
              /></label
            >
          </div>
          <label class="flex min-h-11 items-center gap-2 text-sm font-semibold"
            ><input type="checkbox" name="tank_full" value="true" />{$t(
              "fuel.tankFullLabel",
            )}</label
          >
        {/if}
        <button
          class="button-primary justify-self-start"
          type="submit"
          disabled={busy}>{$t("common.save")}</button
        >
      </form>
    </section>
  {/if}
  <section class="panel grid gap-3 p-5" aria-labelledby="shared-maintenance">
    <h2 class="display text-xl" id="shared-maintenance">
      {$t("nav.maintenance")}
    </h2>
    {#each data.maintenance as record (record.id)}
      <article class="grid gap-1 border-t border-[var(--line)] pt-3">
        <h3 class="font-semibold">
          {bikeName(record.motorcycle_id)} · {record.maintenance_type}
        </h3>
        <p class="numeric text-sm text-[var(--muted)]">
          {$format.date(record.date)} · {$format.distance(record.odometer_km)} · {$format.money(
            record.cost_cents,
          )}
        </p>
        {#if record.description}
          <p class="whitespace-pre-wrap break-words text-sm">
            {record.description}
          </p>
        {/if}
      </article>
    {:else}<p class="text-sm text-[var(--muted)]">
        {$t("sharing.noRecords")}
      </p>{/each}
  </section>
  {#if data.role !== "workshop"}
    <section class="panel overflow-hidden" aria-labelledby="shared-fuel">
      <h2 class="display px-5 pb-3 pt-5 text-xl" id="shared-fuel">
        {$t("nav.fuel")}
      </h2>
      {#if data.fuel.length}
        <div class="data-table">
          <table class="w-full text-left text-sm">
            <thead
              class="border-y border-[var(--line)] bg-[var(--panel-sunken)]"
            >
              <tr>
                <th class={thClass} scope="col">{$t("sharing.date")}</th>
                <th class={thClass} scope="col">{$t("nav.garage")}</th>
                <th class="{thClass} text-right" scope="col"
                  >{$t("fuel.litersLabel")}</th
                >
                <th class="{thClass} text-right" scope="col"
                  >{$t("fuel.totalPriceLabel")}</th
                >
              </tr>
            </thead>
            <tbody>
              {#each data.fuel as record (record.id)}
                <tr class="border-b border-[var(--line)] last:border-b-0">
                  <td class="{tdClass} numeric" data-label={$t("sharing.date")}
                    >{$format.date(record.date)}</td
                  >
                  <td class={tdClass} data-label={$t("nav.garage")}
                    >{bikeName(record.motorcycle_id)}</td
                  >
                  <td
                    class="{tdClass} numeric text-right"
                    data-label={$t("fuel.litersLabel")}
                    >{$format.number(Number(record.liters))} L</td
                  >
                  <td
                    class="{tdClass} numeric text-right"
                    data-label={$t("fuel.totalPriceLabel")}
                    >{$format.money(record.total_price_cents)}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p
          class="border-t border-[var(--line)] px-5 py-4 text-sm text-[var(--muted)]"
        >
          {$t("sharing.noRecords")}
        </p>
      {/if}
    </section>
  {/if}
</div>
