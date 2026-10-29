<script lang="ts">
  import { calendarDay } from "$lib/utils/calendar-day";
  import { page } from "$app/stores";
  import OdometerScan from "$components/OdometerScan.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { t, format } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import CatalogPicker from "$lib/components/CatalogPicker.svelte";
  import InitialHistoryStep from "$lib/components/InitialHistoryStep.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { Motorcycle, Tire } from "$components/icons";
  import type { MotorcycleCatalogPreview } from "$server/domain/motorcycle-catalog";
  import Wrench from "lucide-svelte/icons/wrench";
  import Fuel from "lucide-svelte/icons/fuel";
  import Edit from "lucide-svelte/icons/edit-2";
  import Archive from "lucide-svelte/icons/archive";
  import RotateCcw from "lucide-svelte/icons/rotate-ccw";
  import ChevronDown from "lucide-svelte/icons/chevron-down";

  export let data;
  export let form;

  let custom = false;
  let pendingAction = "";
  let selectedBrand = "";
  let selectedModelId = "";
  let selectedYear = "";
  let resolvedTemplate: MotorcycleCatalogPreview | null = null;

  let createSheet: RecordSheet;
  let editSheet: RecordSheet;
  type GarageMotorcycle = (typeof data.motorcycles)[number];
  let editingMotorcycle: GarageMotorcycle | null = null;

  // One confirmation per action kind; the inline banner used to be the only
  // signal, and a closing sheet hid it.
  const successMessages: Record<string, MessageKey> = {
    create: "garageUx.created",
    odometer: "garageUx.odometerUpdated",
    specs: "garageUx.specsSaved",
    serviceStart: "garageUx.serviceStartSaved",
    archive: "garageUx.archived",
    restore: "garageUx.restored",
  };

  function enhanceAction(action: string): SubmitFunction {
    return () => {
      pendingAction = action;
      return async ({ update, result }) => {
        try {
          await update();
          if (result.type === "success") {
            createSheet?.close();
            editSheet?.close();
            const key = successMessages[action.split(":")[0]];
            if (key) showToast($t(key));
          }
        } finally {
          pendingAction = "";
        }
      };
    };
  }

  function openEdit(motorcycle: GarageMotorcycle) {
    editingMotorcycle = motorcycle;
    editSheet?.open();
  }

  const quickLinkClass =
    "focus-ring inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-semibold text-[var(--fg)] underline-offset-4 hover:underline";
</script>

<svelte:head><title>{$t("garage.pageTitle")} · Moto Track</title></svelte:head>

<section class="grid gap-6">
  <PageHeader
    title={$t("garage.heading")}
    description={$t("garage.description")}
  >
    <svelte:fragment slot="actions">
      <a class="button-secondary min-h-11" href="/garage/access"
        >{$t("sharing.manage")}</a
      >
      {#if data.canAddActive}
        <PageAction
          label={$t("authenticatedUx.addMotorcycle") || $t("garage.newTitle")}
          ariaLabel={$t("authenticatedUx.addMotorcycle") ||
            $t("garage.newTitle")}
          on:click={() => createSheet?.open()}
        />
      {/if}
    </svelte:fragment>
  </PageHeader>

  {#if !data.canAddActive}
    <div
      class="flex flex-col gap-3 rounded-md border border-[var(--line)] bg-[var(--panel-sunken)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div>
        <p class="font-semibold text-[var(--fg)]">
          {$t("authenticatedUx.limitReached")}
        </p>
        <p class="mt-1 text-sm text-[var(--muted)]">
          {$t("garageUx.limitBody")}
        </p>
      </div>
      {#if !$page.data?.nativeStore}<a
          class="button-primary min-h-11 shrink-0"
          href="/precos"
        >
          {$t("authenticatedUx.upgradeToPro")}
        </a>{/if}
    </div>
  {/if}

  {#if form?.message || data.errorMessage}
    <div
      class="flex flex-col gap-3 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="alert"
      aria-live="assertive"
    >
      <span class="text-[var(--danger)]"
        >{form?.message || data.errorMessage}</span
      >
      <a class="button-secondary min-h-11 shrink-0" href="/garage"
        >{$t("common.retry")}</a
      >
    </div>
  {/if}

  {#if data.motorcycles.length}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each data.motorcycles as motorcycle (motorcycle.id)}
        <article
          class:opacity-70={!motorcycle.is_active}
          class="panel flex min-w-0 flex-col"
        >
          <div class="flex-1 p-5">
            <!-- The bike is the hero: identity tile, name and odometer lead. -->
            <div class="flex items-start gap-4">
              <span
                class="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[var(--panel-sunken)] text-[var(--fg-soft)]"
                aria-hidden="true"
              >
                <Motorcycle size={24} />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <h2 class="display break-words text-2xl">
                    {motorcycle.name}
                  </h2>
                  <StatusBadge tone={motorcycle.is_active ? "ok" : "neutral"}
                    >{motorcycle.is_active
                      ? $t("garage.active")
                      : $t("garage.archived")}</StatusBadge
                  >
                </div>
                <p class="mt-0.5 text-sm text-[var(--muted)]">
                  {motorcycle.brand}
                  {motorcycle.model} · {motorcycle.year}
                </p>
              </div>
            </div>

            <div class="mt-5">
              <p class="label-tech text-[var(--muted)]">
                {$t("garageUx.odometer")}
              </p>
              <p class="display numeric mt-1 text-[2.75rem] leading-none">
                {$format.number(Number(motorcycle.current_odometer_km ?? 0))}
                <span class="text-base font-medium text-[var(--muted)]"
                  >{$t("garage.distanceUnit")}</span
                >
              </p>
            </div>

            {#if motorcycle.is_active}
              <nav
                class="mt-4 flex flex-wrap gap-x-5 border-t border-[var(--line)] pt-2"
                aria-label={String(motorcycle.name)}
              >
                <a class={quickLinkClass} href="/maintenance">
                  <Wrench size={16} aria-hidden="true" />
                  {$t("nav.maintenance")}
                </a>
                <a class={quickLinkClass} href="/fuel">
                  <Fuel size={16} aria-hidden="true" />
                  {$t("nav.fuel")}
                </a>
                <a class={quickLinkClass} href="/tires">
                  <Tire size={16} aria-hidden="true" />
                  {$t("nav.tires")}
                </a>
              </nav>

              <details class="group/details border-t border-[var(--line)] pt-1">
                <summary
                  class="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between rounded text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
                >
                  <span>{$t("garage.odometerSpecs")}</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    class="transition-transform duration-200 group-open/details:rotate-180"
                  />
                </summary>
                <form
                  class="mt-2 grid gap-2"
                  method="POST"
                  action="?/updateOdometer"
                  use:enhance={enhanceAction(`odometer:${motorcycle.id}`)}
                  aria-busy={pendingAction === `odometer:${motorcycle.id}`}
                >
                  <input
                    type="hidden"
                    name="motorcycle_id"
                    value={motorcycle.id}
                  />
                  <div class="field-group">
                    <label class="field-label" for={`odometer-${motorcycle.id}`}
                      >{$t("garage.currentOdometer")}</label
                    >
                    <input
                      class="field"
                      id={`odometer-${motorcycle.id}`}
                      name="odometer_override_km"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      step="1"
                      value={motorcycle.current_odometer_km}
                    />
                  </div>
                  <button
                    class="button-secondary min-h-11"
                    disabled={pendingAction === `odometer:${motorcycle.id}`}
                    type="submit"
                  >
                    {$t("garage.updateOdometer")}
                  </button>
                </form>
                <OdometerScan
                  motorcycleId={String(motorcycle.id)}
                  currentKm={Number(motorcycle.current_odometer_km)}
                />
                <form
                  method="POST"
                  action="?/saveServiceStart"
                  use:enhance={enhanceAction(`serviceStart:${motorcycle.id}`)}
                  aria-busy={pendingAction === `serviceStart:${motorcycle.id}`}
                  class="mt-4 grid gap-2 border-t border-[var(--line)] pt-4"
                >
                  <input
                    type="hidden"
                    name="motorcycle_id"
                    value={motorcycle.id}
                  />
                  <div class="field-group">
                    <label
                      class="field-label"
                      for={`service-start-${motorcycle.id}`}
                      >{$t("garage.inServiceDate")}</label
                    >
                    <input
                      class="field"
                      id={`service-start-${motorcycle.id}`}
                      name="in_service_date"
                      type="date"
                      max={calendarDay()}
                      value={String(motorcycle.in_service_date ?? "")}
                      aria-describedby={`service-start-help-${motorcycle.id}`}
                    />
                    <p
                      class="field-help"
                      id={`service-start-help-${motorcycle.id}`}
                    >
                      {$t("garage.inServiceHelp")}
                    </p>
                  </div>
                  <button
                    class="button-secondary min-h-11"
                    type="submit"
                    disabled={pendingAction === `serviceStart:${motorcycle.id}`}
                    >{$t("common.save")}</button
                  >
                </form>
                <form
                  class="mt-4 grid gap-3 border-t border-[var(--line)] pt-4"
                  method="POST"
                  action="?/saveSpecs"
                  use:enhance={enhanceAction(`specs:${motorcycle.id}`)}
                  aria-busy={pendingAction === `specs:${motorcycle.id}`}
                >
                  <input
                    type="hidden"
                    name="motorcycle_id"
                    value={motorcycle.id}
                  />
                  <div class="field-group">
                    <label
                      class="field-label"
                      for={`tire-front-${motorcycle.id}`}
                      >{$t("garage.frontTire")}</label
                    >
                    <input
                      class="field"
                      id={`tire-front-${motorcycle.id}`}
                      name="tire_size_front"
                      value={motorcycle.motorcycle_specs?.[0]
                        ?.tire_size_front ?? ""}
                    />
                  </div>
                  <div class="field-group">
                    <label
                      class="field-label"
                      for={`tire-rear-${motorcycle.id}`}
                      >{$t("garage.rearTire")}</label
                    >
                    <input
                      class="field"
                      id={`tire-rear-${motorcycle.id}`}
                      name="tire_size_rear"
                      value={motorcycle.motorcycle_specs?.[0]?.tire_size_rear ??
                        ""}
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label" for={`manual-${motorcycle.id}`}
                      >{$t("garage.manual")}</label
                    >
                    <input
                      class="field"
                      id={`manual-${motorcycle.id}`}
                      name="manual_reference"
                      value={motorcycle.motorcycle_specs?.[0]
                        ?.manual_reference ?? ""}
                    />
                  </div>
                  <button
                    class="button-secondary min-h-11"
                    disabled={pendingAction === `specs:${motorcycle.id}`}
                    type="submit"
                  >
                    {$t("garage.saveSpecs")}
                  </button>
                </form>
              </details>
            {/if}

            {#if motorcycle.manual_source}
              <div class="mt-2 min-w-0 border-t border-[var(--line)] pt-4">
                <p class="label-tech text-[var(--muted)]">
                  {$t("garage.scheduleSource")}
                </p>
                <a
                  class="mt-1 block break-words text-sm font-semibold text-[var(--fg)] underline underline-offset-4 hover:text-[var(--fg-hover)]"
                  href={motorcycle.manual_source.official_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {motorcycle.manual_source.document_version} ↗
                </a>
                <p class="mt-1 text-xs text-[var(--muted)]">
                  {motorcycle.manual_source.page_reference} · {$t(
                    "garage.verifiedOn",
                  )}
                  {motorcycle.manual_source.last_verified_date}
                </p>
                <p class="mt-1 text-xs text-[var(--muted)]">
                  {motorcycle.manual_source.coverage_notes}
                </p>
              </div>
            {/if}
          </div>

          <div
            class="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3"
          >
            <button
              type="button"
              class="button-secondary min-h-11 px-3"
              on:click={() => openEdit(motorcycle)}
            >
              <Edit size={16} aria-hidden="true" />
              {$t("common.edit")}
            </button>

            {#if motorcycle.is_active}
              <form
                method="POST"
                action="?/archive"
                use:enhance={enhanceAction(`archive:${motorcycle.id}`)}
                aria-busy={pendingAction === `archive:${motorcycle.id}`}
              >
                <input type="hidden" name="id" value={motorcycle.id} />
                <button
                  class="button-secondary min-h-11 px-3 text-[var(--muted)]"
                  disabled={pendingAction === `archive:${motorcycle.id}`}
                  type="submit"
                >
                  <Archive size={16} aria-hidden="true" />
                  {$t("garage.archiveAction")}
                </button>
              </form>
            {:else}
              <form
                method="POST"
                action="?/restore"
                use:enhance={enhanceAction(`restore:${motorcycle.id}`)}
                aria-busy={pendingAction === `restore:${motorcycle.id}`}
              >
                <input type="hidden" name="id" value={motorcycle.id} />
                <button
                  class="button-primary min-h-11 px-3"
                  disabled={pendingAction === `restore:${motorcycle.id}` ||
                    !data.canAddActive}
                  type="submit"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  {$t("garage.restoreAction")}
                </button>
              </form>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <EmptyState
      icon={Motorcycle}
      title={$t("garageUx.emptyTitle")}
      description={$t("garageUx.emptyDescription")}
    >
      {#snippet action()}
        {#if data.canAddActive}
          <button
            type="button"
            class="button-primary"
            on:click={() => createSheet?.open()}
          >
            {$t("garage.newTitle")}
          </button>
        {/if}
      {/snippet}
    </EmptyState>
  {/if}

  <!-- ADD MOTORCYCLE RECORD SHEET -->
  <RecordSheet
    bind:this={createSheet}
    title={$t("garage.newTitle")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/create"
      use:enhance={enhanceAction("create")}
      aria-busy={pendingAction === "create"}
    >
      <div class="field-group">
        <label class="field-label" for="garage-name">
          {$t("garage.nameLabel")}
        </label>
        <input class="field" id="garage-name" name="name" required />
      </div>

      <label class="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input bind:checked={custom} type="checkbox" />
        {$t("garage.customToggle")}
      </label>

      {#if !custom}
        <CatalogPicker
          models={data.models ?? []}
          bind:selectedBrand
          bind:selectedModelId
          bind:selectedYear
          bind:resolvedTemplate
        />
      {:else}
        <input type="hidden" name="model_id" value="" />
        <div class="field-group">
          <label class="field-label" for="garage-brand">
            {$t("garage.brandLabel")}
          </label>
          <input
            class="field"
            id="garage-brand"
            name="brand"
            required={custom}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="garage-model">
            {$t("garage.modelLabel")}
          </label>
          <input
            class="field"
            id="garage-model"
            name="model"
            required={custom}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="garage-year">
            {$t("garage.yearLabel")}
          </label>
          <input
            class="field"
            id="garage-year"
            name="year"
            type="number"
            inputmode="numeric"
            min="1901"
            max={new Date().getFullYear()}
            required
          />
        </div>
      {/if}

      <div class="field-group">
        <label class="field-label" for="garage-odometer">
          {$t("garage.odometerLabel")}
        </label>
        <input
          class="field"
          id="garage-odometer"
          name="current_odometer_km"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          value="0"
          aria-describedby="garage-odometer-help"
        />
        <span class="field-help" id="garage-odometer-help"
          >{$t("garage.odometerHint")}</span
        >
      </div>

      {#if !custom && resolvedTemplate?.is_exact_schedule}
        <details class="rounded border border-[var(--line)] p-3">
          <summary
            class="focus-ring flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold"
          >
            {$t("history.title")}
          </summary>
          <div class="mt-3">
            <InitialHistoryStep
              items={resolvedTemplate.maintenance_items ?? []}
              isExactSchedule={resolvedTemplate.is_exact_schedule}
              showHeading={false}
            />
          </div>
        </details>
      {/if}

      <button
        class="button-primary min-h-11 w-full"
        type="submit"
        disabled={!data.canAddActive || pendingAction === "create"}
      >
        {$t("garage.createAction")}
      </button>
    </form>
  </RecordSheet>

  <!-- EDIT MOTORCYCLE RECORD SHEET -->
  <RecordSheet
    bind:this={editSheet}
    title={$t("common.edit")}
    closeLabel={$t("authenticatedUx.close")}
  >
    {#if editingMotorcycle}
      <div class="grid gap-4">
        <div class="flex items-center gap-3">
          <span
            class="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-[var(--panel-sunken)] text-[var(--fg-soft)]"
            aria-hidden="true"
          >
            <Motorcycle size={24} />
          </span>
          <div class="min-w-0">
            <p class="display break-words text-xl">{editingMotorcycle.name}</p>
            <p class="text-sm text-[var(--muted)]">
              {editingMotorcycle.brand}
              {editingMotorcycle.model} · {editingMotorcycle.year}
            </p>
          </div>
        </div>

        <form
          class="grid gap-3 border-t border-[var(--line)] pt-3"
          method="POST"
          action="?/updateOdometer"
          use:enhance={enhanceAction(`odometer:${editingMotorcycle.id}`)}
          aria-busy={pendingAction === `odometer:${editingMotorcycle.id}`}
        >
          <input
            type="hidden"
            name="motorcycle_id"
            value={editingMotorcycle.id}
          />
          <div class="field-group">
            <label class="field-label" for="edit-odometer-km">
              {$t("garage.currentOdometer")}
            </label>
            <input
              class="field"
              id="edit-odometer-km"
              name="odometer_override_km"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              value={editingMotorcycle.current_odometer_km}
            />
          </div>
          <button
            class="button-secondary min-h-11"
            disabled={pendingAction === `odometer:${editingMotorcycle.id}`}
            type="submit"
          >
            {$t("garage.updateOdometer")}
          </button>
        </form>

        <form
          class="grid gap-3 border-t border-[var(--line)] pt-3"
          method="POST"
          action="?/saveSpecs"
          use:enhance={enhanceAction(`specs:${editingMotorcycle.id}`)}
          aria-busy={pendingAction === `specs:${editingMotorcycle.id}`}
        >
          <input
            type="hidden"
            name="motorcycle_id"
            value={editingMotorcycle.id}
          />
          <div class="field-group">
            <label class="field-label" for="edit-tire-front">
              {$t("garage.frontTire")}
            </label>
            <input
              class="field"
              id="edit-tire-front"
              name="tire_size_front"
              value={editingMotorcycle.motorcycle_specs?.[0]?.tire_size_front ??
                ""}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="edit-tire-rear">
              {$t("garage.rearTire")}
            </label>
            <input
              class="field"
              id="edit-tire-rear"
              name="tire_size_rear"
              value={editingMotorcycle.motorcycle_specs?.[0]?.tire_size_rear ??
                ""}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="edit-manual-ref">
              {$t("garage.manual")}
            </label>
            <input
              class="field"
              id="edit-manual-ref"
              name="manual_reference"
              value={editingMotorcycle.motorcycle_specs?.[0]
                ?.manual_reference ?? ""}
            />
          </div>
          <button
            class="button-primary min-h-11"
            disabled={pendingAction === `specs:${editingMotorcycle.id}`}
            type="submit"
          >
            {$t("garage.saveSpecs")}
          </button>
        </form>
      </div>
    {/if}
  </RecordSheet>
</section>
