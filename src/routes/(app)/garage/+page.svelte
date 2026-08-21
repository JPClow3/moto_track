<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { t } from "$lib/i18n/store";
  import CatalogPicker from "$lib/components/CatalogPicker.svelte";
  import InitialHistoryStep from "$lib/components/InitialHistoryStep.svelte";
  import type { MotorcycleCatalogPreview } from "$server/domain/motorcycle-catalog";
  export let data;
  export let form;

  let custom = false;
  let pendingAction = "";
  let selectedBrand = "";
  let selectedModelId = "";
  let selectedYear = "";
  let resolvedTemplate: MotorcycleCatalogPreview | null = null;

  function enhanceAction(action: string): SubmitFunction {
    return () => {
      pendingAction = action;
      return async ({ update }) => {
        try {
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }
</script>

<svelte:head><title>{$t("garage.pageTitle")} · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>{$t("nav.garage")}
      </p>
      <h1 class="display text-4xl">{$t("garage.heading")}</h1>
      <p class="mt-2 text-sm text-[var(--muted)]">
        {$t("garage.description")}
      </p>
    </div>
  </header>
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
  <div class="grid gap-6 xl:grid-cols-[1fr_340px]">
    <div class="grid gap-4 md:grid-cols-2">
      {#each data.motorcycles as motorcycle}
        <article
          class:opacity-70={!motorcycle.is_active}
          class="panel min-w-0 p-5"
        >
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
          <div class="mt-4 flex flex-wrap gap-2">
            {#if motorcycle.is_active}
              <form
                method="POST"
                action="?/archive"
                use:enhance={enhanceAction(`archive:${motorcycle.id}`)}
                aria-busy={pendingAction === `archive:${motorcycle.id}`}
              >
                <input type="hidden" name="id" value={motorcycle.id} /><button
                  class="button-secondary min-h-11"
                  disabled={pendingAction === `archive:${motorcycle.id}`}
                  type="submit">{$t("garage.archiveAction")}</button
                >
              </form>
            {:else}
              <form
                method="POST"
                action="?/restore"
                use:enhance={enhanceAction(`restore:${motorcycle.id}`)}
                aria-busy={pendingAction === `restore:${motorcycle.id}`}
              >
                <input type="hidden" name="id" value={motorcycle.id} /><button
                  class="button-primary min-h-11"
                  disabled={pendingAction === `restore:${motorcycle.id}`}
                  type="submit">{$t("garage.restoreAction")}</button
                >
              </form>
            {/if}
          </div>
          {#if motorcycle.is_active}
            <!-- Jump-off points: the garage is the hub, so each card routes
                 straight into the bike's data instead of forcing a detour
                 through the sidebar. -->
            <div
              class="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-xs"
            >
              <a
                class="font-semibold text-brand underline-offset-4 hover:underline"
                href="/maintenance">{$t("nav.maintenance")}</a
              >
              <a
                class="font-semibold text-brand underline-offset-4 hover:underline"
                href="/fuel">{$t("nav.fuel")}</a
              >
              <a
                class="font-semibold text-brand underline-offset-4 hover:underline"
                href="/tires">{$t("nav.tires")}</a
              >
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
                /><label class="grid gap-1 text-sm"
                  >{$t("garage.currentOdometer")}<input
                    class="field"
                    name="odometer_override_km"
                    type="number"
                    min="0"
                    value={motorcycle.current_odometer_km}
                  /></label
                ><button
                  class="button-secondary min-h-11"
                  disabled={pendingAction === `odometer:${motorcycle.id}`}
                  type="submit">{$t("garage.updateOdometer")}</button
                >
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
                /><label class="text-sm"
                  >{$t("garage.frontTire")}<input
                    class="field"
                    name="tire_size_front"
                    value={motorcycle.motorcycle_specs?.[0]?.tire_size_front ??
                      ""}
                  /></label
                ><label class="text-sm"
                  >{$t("garage.rearTire")}<input
                    class="field"
                    name="tire_size_rear"
                    value={motorcycle.motorcycle_specs?.[0]?.tire_size_rear ??
                      ""}
                  /></label
                ><label class="text-sm"
                  >{$t("garage.manual")}<input
                    class="field"
                    name="manual_reference"
                    value={motorcycle.motorcycle_specs?.[0]?.manual_reference ??
                      ""}
                  /></label
                ><button
                  class="button-secondary min-h-11"
                  disabled={pendingAction === `specs:${motorcycle.id}`}
                  type="submit">{$t("garage.saveSpecs")}</button
                >
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
                >{motorcycle.manual_source.document_version} ↗</a
              >
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
          {#if motorcycle.template_documents.length}
            <div class="mt-4 border-t border-[var(--line)] pt-3">
              <p class="label-tech text-xs text-[var(--muted)]">
                {$t("garage.officialDocs")}
              </p>
              {#each motorcycle.template_documents as document}
                <a
                  class="mt-1 block text-sm font-semibold text-brand underline-offset-4 hover:underline"
                  href={document.external_url}
                  target="_blank"
                  rel="noreferrer">{document.title} ↗</a
                >
                <p class="mt-1 text-xs text-[var(--muted)]">{document.notes}</p>
              {/each}
            </div>
          {/if}
        </article>
      {:else}
        <div class="panel col-span-full p-10 text-center">
          <p class="display text-2xl">{$t("garage.heading")}</p>
          <p class="mt-2 text-sm text-[var(--muted)]">
            {$t("garage.emptyState")}
          </p>
        </div>
      {/each}
    </div>
    <form
      class="panel grid gap-3 p-5"
      method="POST"
      action="?/create"
      use:enhance={enhanceAction("create")}
      aria-busy={pendingAction === "create"}
    >
      <h2 class="text-lg font-bold">{$t("garage.newTitle")}</h2>
      <label class="text-sm">
        {$t("garage.nameLabel")}<input class="field" name="name" required />
      </label>
      <label class="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input bind:checked={custom} type="checkbox" />
        {$t("garage.customToggle")}
      </label>
      {#if !custom}
        <CatalogPicker
          models={data.models}
          bind:selectedBrand
          bind:selectedModelId
          bind:selectedYear
          bind:resolvedTemplate
        />
      {:else}
        <input type="hidden" name="model_id" value="" />
        <label class="text-sm">
          {$t("garage.brandLabel")}<input
            class="field"
            name="brand"
            required={custom}
          />
        </label>
        <label class="text-sm">
          {$t("garage.modelLabel")}<input
            class="field"
            name="model"
            required={custom}
          />
        </label>
        <label class="text-sm">
          {$t("garage.yearLabel")}<input
            class="field"
            name="year"
            type="number"
            min="1901"
            max={new Date().getFullYear()}
            required
          />
        </label>
      {/if}
      <label class="text-sm"
        >{$t("garage.odometerLabel")}<input
          class="field"
          name="current_odometer_km"
          type="number"
          min="0"
          value="0"
        />
        <span class="mt-1 block text-xs text-[var(--muted)]">
          {$t("garage.odometerHint")}
        </span></label
      >
      {#if !custom && resolvedTemplate?.is_exact_schedule}
        <!-- Collapsed by default: the checklist is long and was pushing the
             "Cadastrar moto" button below the fold. -->
        <details class="rounded border border-[var(--line)] p-3">
          <summary
            class="focus-ring flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold"
            >{$t("history.title")}</summary
          >
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
        class="button-primary min-h-11"
        type="submit"
        disabled={!data.canAddActive || pendingAction === "create"}
        >{$t("garage.createAction")}</button
      >{#if !data.canAddActive}<p class="text-xs text-[var(--muted)]">
          {$t("garage.freeLimit")}
        </p>{/if}
    </form>
  </div>
</section>
