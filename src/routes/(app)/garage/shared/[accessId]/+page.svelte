<script lang="ts">
  import { enhance } from "$app/forms";
  import { format, t } from "$lib/i18n/store";
  import PageHeader from "$components/app/PageHeader.svelte";
  export let data;
  export let form;
  let feature = "maintenance";
  let busy = false;
  const bikeName = (id: string) =>
    data.motorcycles.find(
      (bike: { id: string; name: string }) => bike.id === id,
    )?.name ?? "";
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
  {#if form?.message}<p class="panel p-4 text-danger" role="alert">
      {form.message}
    </p>{/if}
  {#if form?.ok}<p class="panel p-4" role="status">
      {$t("common.actionSuccess")}
    </p>{/if}
  <section
    class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    aria-label={$t("nav.garage")}
  >
    {#each data.motorcycles as bike}
      <article class="panel grid gap-2 p-5">
        <h2 class="display text-2xl">{bike.name}</h2>
        <p class="text-sm text-[var(--muted)]">
          {bike.brand}
          {bike.model} · {bike.year}
        </p>
        <p class="font-semibold">
          {$format.distance(bike.current_odometer_km)}
        </p>
      </article>
    {:else}<p class="text-sm text-[var(--muted)]">
        {$t("sharing.noBikes")}
      </p>{/each}
  </section>
  {#if data.role !== "viewer" && data.motorcycles.length}
    <section class="panel grid gap-4 p-5" aria-labelledby="shared-create">
      <h2 class="display text-2xl" id="shared-create">
        {$t("sharing.addRecord")}
      </h2>
      <p class="text-sm text-[var(--muted)]">{$t("sharing.recordHelp")}</p>
      <form
        class="grid gap-4"
        method="POST"
        action="?/record"
        use:enhance={() => {
          busy = true;
          return async ({ update }) => {
            busy = false;
            await update();
          };
        }}
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
              >{#each data.motorcycles as bike}<option value={bike.id}
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
              value={new Date().toISOString().slice(0, 10)}
              max={new Date().toISOString().slice(0, 10)}
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
                type="number"
                min="0"
                max="21474836.47"
                step="0.01"
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
                type="number"
                min="0.001"
                max="1000"
                step="0.001"
                required
              /></label
            >
            <label class="field-group" for="shared-total"
              ><span class="field-label">{$t("fuel.totalPriceLabel")}</span
              ><input
                class="field"
                id="shared-total"
                name="total_price_cents"
                type="number"
                min="0.01"
                max="21474836.47"
                step="0.01"
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
          <label class="flex items-center gap-2 text-sm"
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
  <section class="panel grid gap-4 p-5" aria-labelledby="shared-maintenance">
    <h2 class="display text-2xl" id="shared-maintenance">
      {$t("nav.maintenance")}
    </h2>
    {#each data.maintenance as record}
      <article class="grid gap-1 border-t border-[var(--line)] pt-3">
        <h3 class="font-semibold">
          {bikeName(record.motorcycle_id)} · {record.maintenance_type}
        </h3>
        <p class="text-sm text-[var(--muted)]">
          {$format.date(record.date)} · {$format.distance(record.odometer_km)} · {$format.money(
            record.cost_cents,
          )}
        </p>
        <p class="whitespace-pre-wrap break-words text-sm">
          {record.description}
        </p>
      </article>
    {:else}<p class="text-sm text-[var(--muted)]">
        {$t("sharing.noRecords")}
      </p>{/each}
  </section>
  {#if data.role !== "workshop"}
    <section class="panel grid gap-4 p-5" aria-labelledby="shared-fuel">
      <h2 class="display text-2xl" id="shared-fuel">{$t("nav.fuel")}</h2>
      {#each data.fuel as record}<p
          class="border-t border-[var(--line)] pt-3 text-sm"
        >
          {bikeName(record.motorcycle_id)} · {$format.date(record.date)} · {$format.number(
            Number(record.liters),
          )} L · {$format.money(record.total_price_cents)}
        </p>{:else}<p class="text-sm text-[var(--muted)]">
          {$t("sharing.noRecords")}
        </p>{/each}
    </section>
  {/if}
</div>
