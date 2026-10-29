<script lang="ts">
  import { enhance } from "$app/forms";
  import { t } from "$lib/i18n/store";
  import CatalogPicker from "$lib/components/CatalogPicker.svelte";
  import InitialHistoryStep from "$lib/components/InitialHistoryStep.svelte";
  import { Motorcycle } from "$components/icons";
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
  <header class="flex items-start gap-4">
    <span
      class="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-[var(--panel-sunken)] text-[var(--fg-soft)]"
      aria-hidden="true"
    >
      <Motorcycle size={24} />
    </span>
    <div class="min-w-0">
      <p class="text-sm font-semibold text-[var(--muted)]">
        {$t("onboarding.eyebrow")}
      </p>
      <h1 class="display text-4xl">{$t("onboarding.heading")}</h1>
    </div>
  </header>
  {#if form?.message}<p
      class="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
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
    class="panel grid gap-4 p-5"
    bind:this={formElement}
  >
    <!-- Calm step indicator: a muted caption and a two-segment ink bar. -->
    <div class="grid gap-2">
      <p class="text-sm font-semibold text-[var(--muted)]" aria-live="polite">
        {$t("garageUx.onboardingStep", { step: String(step) })}
      </p>
      <div class="grid grid-cols-2 gap-1.5" aria-hidden="true">
        <span class="h-1 rounded-full bg-[var(--fg)]"></span>
        <span
          class="h-1 rounded-full {step === 2
            ? 'bg-[var(--fg)]'
            : 'bg-[var(--line)]'}"
        ></span>
      </div>
    </div>
    {#if step === 1}
      <div class="field-group">
        <label class="field-label" for="onboarding-name"
          >{$t("onboarding.nameLabel")}</label
        >
        <input
          class="field"
          id="onboarding-name"
          name="name"
          bind:value={motorcycleName}
          required
        />
      </div>
      <div class="border-y border-[var(--line)] py-3">
        <label class="flex min-h-11 items-center gap-2 text-sm font-semibold">
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
            <div class="field-group">
              <label class="field-label" for="onboarding-brand"
                >{$t("garage.brandLabel")}</label
              >
              <input
                class="field"
                id="onboarding-brand"
                name="brand"
                bind:value={customBrand}
                required={custom}
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="onboarding-model"
                >{$t("garage.modelLabel")}</label
              >
              <input
                class="field"
                id="onboarding-model"
                name="model"
                bind:value={customModel}
                required={custom}
              />
            </div>
          </div>
          <div class="field-group mt-3">
            <label class="field-label" for="onboarding-year"
              >{$t("garage.yearLabel")}</label
            >
            <input
              class="field"
              id="onboarding-year"
              name="year"
              type="number"
              inputmode="numeric"
              bind:value={selectedYear}
              min="1901"
              max={new Date().getFullYear()}
              required
            />
          </div>
        {/if}
      </div>
      <div class="field-group">
        <label class="field-label" for="onboarding-odometer"
          >{$t("onboarding.odometerLabel")}</label
        >
        <input
          class="field"
          id="onboarding-odometer"
          name="current_odometer_km"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          bind:value={odometer}
          aria-describedby="onboarding-odometer-help"
        />
        <span class="field-help" id="onboarding-odometer-help">
          {$t("garage.odometerHint")}
        </span>
      </div>
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
        <p class="rounded-md bg-[var(--panel-sunken)] p-3 text-sm">
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
