<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { t } from "$lib/i18n/store";
  export let data;
  export let form;

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: localizedFeature = {
    ...data.feature,
    slug: $t("nav.reminders"),
    title: $t("reminders.pageTitle"),
    subtitle: $t("reminders.pageSubtitle"),
  };
</script>

<svelte:head
  ><title>{$t("reminders.pageTitle")} · Moto Track</title></svelte:head
>

{#if !hasMotorcycles}
  <div
    class="border-[var(--accent)]/30 mb-6 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    role="status"
    aria-live="polite"
  >
    <span class="text-[var(--accent)]">{$t("reminders.noMotorcyclesHint")}</span
    >
    <a class="button-secondary min-h-11 shrink-0" href="/garage"
      >{$t("reminders.goToGarage")}</a
    >
  </div>
{/if}

{#if form?.message || data.errorMessage}
  <div
    class="border-[var(--accent)]/30 mb-6 flex flex-col gap-3 rounded border bg-[var(--accent-soft)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    role="alert"
    aria-live="assertive"
  >
    <span class="text-[var(--accent)]"
      >{form?.message || data.errorMessage}</span
    >
    <a class="button-secondary min-h-11 shrink-0" href="/reminders"
      >{$t("common.retry")}</a
    >
  </div>
{/if}

{#if form?.ok}
  <p
    class="border-[var(--success)]/30 bg-[var(--success)]/10 mb-6 rounded border p-3 text-sm text-[var(--success)]"
    role="status"
    aria-live="polite"
  >
    {$t("common.actionSuccess")}
  </p>
{/if}

<FeaturePage
  feature={localizedFeature}
  rows={data.rows}
  motorcycles={data.motorcycles}
  errorMessage=""
/>
