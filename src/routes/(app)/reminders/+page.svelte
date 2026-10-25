<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { t } from "$lib/i18n/store";
  import { enhance } from "$app/forms";
  export let data;
  export let form;

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: localizedFeature = {
    ...data.feature,
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
  routeSlug="reminders"
  feature={localizedFeature}
  rows={data.rows}
  motorcycles={data.motorcycles}
  errorMessage=""
/>

<section class="panel mt-6 grid gap-4 p-5" aria-labelledby="calendar-heading">
  <h2 id="calendar-heading" class="display text-2xl">
    {$t("calendar.heading")}
  </h2>
  <p class="text-sm text-[var(--muted)]">{$t("calendar.help")}</p>
  <div class="flex flex-wrap gap-3">
    <a class="button-secondary" href="/reminders/calendar.ics"
      >{$t("calendar.download")}</a
    >
    <form method="POST" action="?/createCalendar" use:enhance>
      <button class="button-primary" type="submit"
        >{$t("calendar.create")}</button
      >
    </form>
  </div>
  {#if form?.calendarUrl}
    <div class="grid gap-2" role="status">
      <label class="field-label" for="calendar-url">{$t("calendar.url")}</label>
      <input
        class="field w-full"
        id="calendar-url"
        value={form.calendarUrl}
        readonly
        on:focus={(event) => event.currentTarget.select()}
      />
      <p class="text-sm text-[var(--muted)]">{$t("calendar.secret")}</p>
    </div>
  {/if}
  {#each data.calendars as calendar}
    <form
      class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
      method="POST"
      action="?/revokeCalendar"
      use:enhance
    >
      <span class="text-sm"
        >{calendar.token_prefix}… · {$t("calendar.expires")}: {calendar.expires_at.slice(
          0,
          10,
        )}</span
      >
      <input type="hidden" name="id" value={calendar.id} />
      <button class="button-secondary" type="submit"
        >{$t("calendar.revoke")}</button
      >
    </form>
  {/each}
</section>
