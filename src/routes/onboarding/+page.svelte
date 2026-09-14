<script lang="ts">
  import { enhance } from "$app/forms";
  import { t } from "$lib/i18n/store";
  import CatalogPicker from "$lib/components/CatalogPicker.svelte";
  import InitialHistoryStep from "$lib/components/InitialHistoryStep.svelte";
  import type { MotorcycleCatalogPreview } from "$server/domain/motorcycle-catalog";
  export let data;
  export let form;

  let custom = false;
  let motorcycleName = "";
  let customBrand = "";
  let customModel = "";
  let odometer = "0";
  let step = 1;
  let formElement: HTMLFormElement;

  let selectedBrand = "";
  let selectedModelId = "";
  let selectedYear = "";
  let resolvedTemplate: MotorcycleCatalogPreview | null = null;

  function openHistory() {
    if (!formElement.reportValidity()) return;
    if (custom || !resolvedTemplate?.is_exact_schedule) {
      formElement.requestSubmit();
      return;
    }
    step = 2;
  }
</script>

<section class="mx-auto grid max-w-xl gap-6">
  <header>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>{$t(
        "onboarding.eyebrow",
      )}
    </p>
    <h1 class="display text-4xl">{$t("onboarding.heading")}</h1>
  </header>
  {#if form?.message}<p
      class="rounded bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
      tabindex="-1"
    >
      {form.message}
    </p>{/if}
  <form
    method="POST"
    action="?/create"
    use:enhance
    class="panel grid gap-3 p-5"
    bind:this={formElement}
  >
    <p class="label-tech text-[var(--accent)]" aria-live="polite">
      {$t("onboarding.step", { step: String(step) })}
    </p>
    {#if step === 1}
      <label class="text-sm">
        {$t("onboarding.nameLabel")}<input
          class="field"
          name="name"
          bind:value={motorcycleName}
          required
        />
      </label>
      <div class="border-y border-[var(--line)] py-3">
        <label
          class="flex min-h-11 items-center gap-2 rounded px-2 text-sm font-semibold"
        >
          <input bind:checked={custom} type="checkbox" />
          {$t("onboarding.catalogToggle")}
        </label>
        {#if !custom}
          <p class="mt-1 text-xs text-[var(--muted)]">
            {$t("catalog.pickerHint")}
          </p>
          <div class="mt-3">
            <CatalogPicker
              models={data.models}
              bind:selectedBrand
              bind:selectedModelId
              bind:selectedYear
              bind:resolvedTemplate
            />
          </div>
        {:else}
          <input type="hidden" name="model_id" value="" />
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <label class="text-sm">
              {$t("garage.brandLabel")}<input
                class="field"
                name="brand"
                bind:value={customBrand}
                required={custom}
              />
            </label>
            <label class="text-sm">
              {$t("garage.modelLabel")}<input
                class="field"
                name="model"
                bind:value={customModel}
                required={custom}
              />
            </label>
          </div>
          <label class="mt-3 block text-sm">
            {$t("garage.yearLabel")}<input
              class="field"
              name="year"
              type="number"
              bind:value={selectedYear}
              min="1901"
              max={new Date().getFullYear()}
              required
            />
          </label>
        {/if}
      </div>
      <label class="text-sm">
        {$t("onboarding.odometerLabel")}<input
          class="field"
          name="current_odometer_km"
          type="number"
          min="0"
          bind:value={odometer}
        />
        <span class="mt-1 block text-xs text-[var(--muted)]">
          {$t("garage.odometerHint")}
        </span>
      </label>
      <button class="button-primary" type="button" on:click={openHistory}
        >{!custom && resolvedTemplate?.is_exact_schedule
          ? $t("onboarding.continueToHistory")
          : $t("onboarding.createBike")}</button
      >
    {:else}
      <input type="hidden" name="name" value={motorcycleName} />
      <input
        type="hidden"
        name="model_id"
        value={custom ? "" : selectedModelId}
      />
      <input
        type="hidden"
        name="brand"
        value={custom ? customBrand : (resolvedTemplate?.brand ?? "")}
      />
      <input
        type="hidden"
        name="model"
        value={custom ? customModel : (resolvedTemplate?.model ?? "")}
      />
      <input type="hidden" name="year" value={selectedYear} />
      <input type="hidden" name="current_odometer_km" value={odometer} />
      {#if resolvedTemplate}
        <InitialHistoryStep
          items={resolvedTemplate.maintenance_items ?? []}
          isExactSchedule={resolvedTemplate.is_exact_schedule}
        />
      {:else}
        <p class="bg-[var(--muted)]/10 rounded p-3 text-sm">
          {$t("onboarding.noExactSchedule")}
        </p>
      {/if}
      <div class="flex gap-3">
        <button
          class="button-secondary"
          type="button"
          on:click={() => (step = 1)}>{$t("onboarding.back")}</button
        >
        <button class="button-primary flex-1" type="submit"
          >{$t("onboarding.createBike")}</button
        >
      </div>
    {/if}
  </form>
  <form method="POST" action="?/demo" use:enhance>
    <button class="button-secondary w-full" type="submit"
      >{$t("onboarding.demoAction")}</button
    >
  </form>
</section>
