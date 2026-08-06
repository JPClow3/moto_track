<script lang="ts">
  import { t } from "$lib/i18n/store";
  import type {
    CatalogModel,
    MotorcycleCatalogPreview,
  } from "$server/domain/motorcycle-catalog";

  export let models: CatalogModel[];
  export let selectedBrand = "";
  export let selectedModelId = "";
  export let selectedYear = "";
  // Bound out so the host form can describe the resolved schedule and, in
  // onboarding, render one history question per maintenance item.
  export let resolvedTemplate: MotorcycleCatalogPreview | null = null;

  $: brands = [...new Set(models.map((model) => model.brand))];
  $: brandModels = models.filter((model) => model.brand === selectedBrand);
  $: selectedModel =
    models.find((model) => model.id === selectedModelId) ?? null;
  $: years = selectedModel?.years ?? [];
  $: resolvedTemplate = selectedYear
    ? (selectedModel?.templatesByYear[selectedYear] ?? null)
    : null;

  function resetModel() {
    selectedModelId = "";
    selectedYear = "";
  }

  function resetYear() {
    selectedYear = "";
  }
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <label class="text-sm">
    {$t("catalog.brandLabel")}<select
      class="field"
      bind:value={selectedBrand}
      on:change={resetModel}
      required
    >
      <option value="" disabled>{$t("common.select")}</option>
      {#each brands as brand}
        <option value={brand}>{brand}</option>
      {/each}
    </select>
  </label>
  <label class="text-sm">
    {$t("catalog.modelLabel")}<select
      class="field"
      bind:value={selectedModelId}
      on:change={resetYear}
      required
      disabled={!selectedBrand}
    >
      <option value="" disabled
        >{selectedBrand
          ? $t("common.select")
          : $t("catalog.chooseBrandFirst")}</option
      >
      {#each brandModels as model (model.id)}
        <option value={model.id}>{model.displayName}</option>
      {/each}
    </select>
  </label>
</div>

{#if selectedModel}
  <label class="mt-3 block text-sm">
    {$t("catalog.yearLabel")}<select
      class="field"
      name="year"
      bind:value={selectedYear}
      required
    >
      <option value="" disabled>{$t("common.select")}</option>
      {#each years as year}
        <option value={String(year)}>{year}</option>
      {/each}
    </select>
  </label>
  {#if !years.length}
    <p class="mt-1 text-xs text-[var(--accent)]">
      {$t("catalog.noYearsAvailable")}
    </p>
  {/if}
{/if}

<input type="hidden" name="model_id" value={selectedModelId} />

{#if selectedModel}
  <p class="mt-3">
    <span
      class="label-tech rounded px-2 py-1 text-xs {selectedModel.hasExactSchedule
        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
        : 'bg-[var(--panel-sunken)] text-[var(--muted)]'}"
      >{selectedModel.hasExactSchedule
        ? $t("catalog.exactBadge")
        : $t("catalog.lineBadge")}</span
    >
  </p>
{/if}

{#if resolvedTemplate}
  <p class="mt-2 text-xs text-[var(--muted)]">
    {resolvedTemplate.is_exact_schedule
      ? $t("catalog.exactNote")
      : $t("catalog.lineNote")}
    {#if resolvedTemplate.is_exact_schedule && resolvedTemplate.maintenance_count}
      {resolvedTemplate.maintenance_count}
      {$t("catalog.sourcedItems")}
    {/if}
  </p>
  <p class="mt-1 text-xs text-[var(--muted)]">
    {$t("catalog.source")}: {resolvedTemplate.document_version} · {resolvedTemplate.page_reference}
    · {$t("catalog.verifiedOn")}
    {resolvedTemplate.last_verified_date}
  </p>
  {#if resolvedTemplate.coverage_notes}
    <p class="mt-1 text-xs text-[var(--muted)]">
      {resolvedTemplate.coverage_notes}
    </p>
  {/if}
  {#if resolvedTemplate.manual_url}
    <a
      class="mt-2 inline-block text-xs font-semibold text-brand underline-offset-4 hover:underline"
      href={resolvedTemplate.manual_url}
      target="_blank"
      rel="noreferrer">{$t("catalog.openDocument")} ↗</a
    >
  {/if}
{:else if selectedModel && selectedYear}
  <p class="mt-2 text-xs text-[var(--accent)]">
    {$t("catalog.noTemplateForYear")}
  </p>
{/if}
