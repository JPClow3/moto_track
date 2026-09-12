<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { t } from "$lib/i18n/store";
  import CatalogPicker from "$lib/components/CatalogPicker.svelte";
  import InitialHistoryStep from "$lib/components/InitialHistoryStep.svelte";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import type { MotorcycleCatalogPreview } from "$server/domain/motorcycle-catalog";
  import Wrench from "lucide-svelte/icons/wrench";
  import Fuel from "lucide-svelte/icons/fuel";
  import CircleGauge from "lucide-svelte/icons/circle-gauge";
  import Edit from "lucide-svelte/icons/edit-2";
  import Archive from "lucide-svelte/icons/archive";
  import RotateCcw from "lucide-svelte/icons/rotate-ccw";

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
  let confirmDialog: ConfirmDialog;
  type GarageMotorcycle = (typeof data.motorcycles)[number];
  let editingMotorcycle: GarageMotorcycle | null = null;

  function enhanceAction(action: string): SubmitFunction {
    return () => {
      pendingAction = action;
      return async ({ update, result }) => {
        try {
          await update();
          if (result.type === "success") {
            createSheet?.close();
            editSheet?.close();
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
</script>

<svelte:head><title>{$t("garage.pageTitle")} · Moto Track</title></svelte:head>

<section class="grid gap-6">
  <PageHeader
    eyebrow={$t("nav.garage")}
    title={$t("garage.heading")}
    description={$t("garage.description")}
  >
    <svelte:fragment slot="actions">
      {#if data.canAddActive}
        <PageAction
          label={$t("authenticatedUx.addMotorcycle") || $t("garage.newTitle")}
          ariaLabel={$t("authenticatedUx.addMotorcycle") ||
            $t("garage.newTitle")}
          on:click={() => createSheet?.open()}
        />
      {:else}
        <a
          href="/precos"
          class="button-accent inline-flex min-h-11 items-center gap-2 px-4 text-xs"
        >
          {$t("authenticatedUx.upgradeToPro")}
        </a>
      {/if}
    </svelte:fragment>
  </PageHeader>

  {#if !data.canAddActive}
    <div
      class="border-[var(--accent)]/30 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div>
        <p class="font-bold text-[var(--accent)]">
          {$t("authenticatedUx.limitReached")}
        </p>
        <p class="mt-1 text-xs text-[var(--muted)]">{$t("garage.freeLimit")}</p>
      </div>
      <a
        class="button-accent min-h-9 shrink-0 px-3 py-1 text-xs"
        href="/precos"
      >
        {$t("authenticatedUx.upgradeToPro")}
      </a>
    </div>
  {/if}

  {#if form?.message || data.errorMessage}
    <div
      class="border-[var(--accent)]/30 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      role="alert"
      aria-live="assertive"
    >
      <span class="text-[var(--accent)]"
        >{form?.message || data.errorMessage}</span
      >
      <a class="button-secondary min-h-11 shrink-0" href="/garage"
        >{$t("common.retry")}</a
      >
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
    confirmLabel={$t("common.confirm")}
  />

  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each data.motorcycles as motorcycle}
      <article
        class:opacity-70={!motorcycle.is_active}
        class="panel flex min-w-0 flex-col justify-between p-5"
      >
        <div>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="break-words text-xl font-bold">{motorcycle.name}</h2>
              <p class="text-sm text-[var(--muted)]">
                {motorcycle.brand}
                {motorcycle.model} · {motorcycle.year}
              </p>
            </div>
            <span
              class={`label-tech shrink-0 rounded-full px-2.5 py-1 text-xs ${motorcycle.is_active ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-[var(--muted)]/15 text-[var(--muted)]"}`}
              >{motorcycle.is_active
                ? $t("garage.active")
                : $t("garage.archived")}</span
            >
          </div>

          <p class="display numeric mt-4 text-4xl">
            {motorcycle.current_odometer_km}
            <span class="text-base font-medium"
              >{$t("garage.distanceUnit")}</span
            >
          </p>

          {#if motorcycle.is_active}
            <div
              class="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-xs"
            >
              <a
                class="flex items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline"
                href="/maintenance"
              >
                <Wrench size={13} aria-hidden="true" />
                {$t("nav.maintenance")}
              </a>
              <a
                class="flex items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline"
                href="/fuel"
              >
                <Fuel size={13} aria-hidden="true" />
                {$t("nav.fuel")}
              </a>
              <a
                class="flex items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline"
                href="/tires"
              >
                <CircleGauge size={13} aria-hidden="true" />
                {$t("nav.tires")}
              </a>
            </div>

            <details
              class="group/details mt-4 border-t border-[var(--line)] pt-3"
            >
              <summary
                class="focus-ring flex min-h-11 cursor-pointer items-center justify-between rounded px-1 font-semibold text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
              >
                <span>{$t("garage.odometerSpecs")}</span>
                <span
                  class="label-tech text-[10px] text-[var(--accent)] transition-transform duration-200 group-open/details:rotate-180"
                  aria-hidden="true">▼</span
                >
              </summary>
              <form
                class="mt-3 grid gap-2"
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
                <label class="grid gap-1 text-sm">
                  {$t("garage.currentOdometer")}
                  <input
                    class="field"
                    name="odometer_override_km"
                    type="number"
                    min="0"
                    value={motorcycle.current_odometer_km}
                  />
                </label>
                <button
                  class="button-secondary min-h-11"
                  disabled={pendingAction === `odometer:${motorcycle.id}`}
                  type="submit"
                >
                  {$t("garage.updateOdometer")}
                </button>
              </form>
              <form
                class="mt-3 grid gap-2"
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
                <label class="text-sm">
                  {$t("garage.frontTire")}
                  <input
                    class="field"
                    name="tire_size_front"
                    value={motorcycle.motorcycle_specs?.[0]?.tire_size_front ??
                      ""}
                  />
                </label>
                <label class="text-sm">
                  {$t("garage.rearTire")}
                  <input
                    class="field"
                    name="tire_size_rear"
                    value={motorcycle.motorcycle_specs?.[0]?.tire_size_rear ??
                      ""}
                  />
                </label>
                <label class="text-sm">
                  {$t("garage.manual")}
                  <input
                    class="field"
                    name="manual_reference"
                    value={motorcycle.motorcycle_specs?.[0]?.manual_reference ??
                      ""}
                  />
                </label>
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
            <div class="mt-4 min-w-0 border-t border-[var(--line)] pt-4">
              <p class="label-tech text-[var(--accent)]">
                {$t("garage.scheduleSource")}
              </p>
              <a
                class="mt-1 block break-words text-sm font-semibold text-brand underline-offset-4 hover:underline"
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
          class="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"
        >
          <button
            type="button"
            class="button-secondary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs"
            on:click={() => openEdit(motorcycle)}
          >
            <Edit size={13} aria-hidden="true" />
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
                class="button-secondary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs text-[var(--muted)]"
                disabled={pendingAction === `archive:${motorcycle.id}`}
                type="submit"
              >
                <Archive size={13} aria-hidden="true" />
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
                class="button-primary inline-flex min-h-9 items-center gap-1.5 px-3 text-xs"
                disabled={pendingAction === `restore:${motorcycle.id}`}
                type="submit"
              >
                <RotateCcw size={13} aria-hidden="true" />
                {$t("garage.restoreAction")}
              </button>
            </form>
          {/if}
        </div>
      </article>
    {:else}
      <div class="panel col-span-full p-10 text-center">
        <p class="display text-2xl">{$t("garage.heading")}</p>
        <p class="mt-2 text-sm text-[var(--muted)]">
          {$t("garage.emptyState")}
        </p>
        {#if data.canAddActive}
          <button
            type="button"
            class="button-primary mt-4"
            on:click={() => createSheet?.open()}
          >
            {$t("garage.newTitle")}
          </button>
        {/if}
      </div>
    {/each}
  </div>

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
          min="0"
          value="0"
        />
        <span class="field-help">{$t("garage.odometerHint")}</span>
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
        <p class="text-lg font-bold">{editingMotorcycle.name}</p>
        <p class="text-sm text-[var(--muted)]">
          {editingMotorcycle.brand}
          {editingMotorcycle.model} · {editingMotorcycle.year}
        </p>

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
              min="0"
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
