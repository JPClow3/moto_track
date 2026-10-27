<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { resolve } from "$app/paths";
  import { t } from "$lib/i18n/store";
  import { enhance } from "$app/forms";
  let { data, form } = $props();

  let hasMotorcycles = $derived(data.motorcycles.length > 0);
  let localizedFeature = $derived({
    ...data.feature,
    title: $t("reminders.pageTitle"),
    subtitle: $t("reminders.pageSubtitle"),
  });
  let showCalendarSecondary = $derived(
    data.calendars.length > 0 || Boolean(form?.calendarUrl),
  );
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
    <a class="button-secondary min-h-11 shrink-0" href={resolve("/garage")}
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
    <a class="button-secondary min-h-11 shrink-0" href={resolve("/reminders")}
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
>
  <svelte:fragment slot="overflow">
    <a
      class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--line)]"
      href={resolve("/reminders/calendar.ics")}
    >
      {$t("calendar.download")}
    </a>
    <form method="POST" action="?/createCalendar" use:enhance>
      <button
        class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--line)]"
        type="submit"
      >
        {$t("calendar.create")}
      </button>
    </form>
  </svelte:fragment>

  <svelte:fragment slot="afterHeader">
    {#if showCalendarSecondary}
      <section
        class="grid gap-3 text-sm text-[var(--muted)]"
        aria-labelledby="calendar-heading"
      >
        <h2
          id="calendar-heading"
          class="label-tech text-xs text-[var(--muted)]"
        >
          {$t("calendar.heading")}
        </h2>
        {#if form?.calendarUrl}
          <div class="grid gap-2" role="status">
            <label class="field-label" for="calendar-url"
              >{$t("calendar.url")}</label
            >
            <input
              class="field w-full"
              id="calendar-url"
              value={form.calendarUrl}
              readonly
              onfocus={(event) => event.currentTarget.select()}
            />
            <p class="text-sm text-[var(--muted)]">{$t("calendar.secret")}</p>
          </div>
        {/if}
        {#each data.calendars as calendar (calendar.id)}
          <form
            class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
            method="POST"
            action="?/revokeCalendar"
            use:enhance
          >
            <span class="text-sm text-[var(--fg)]"
              >{calendar.token_prefix}… · {$t("calendar.expires")}: {calendar.expires_at.slice(
                0,
                10,
              )}</span
            >
            <input type="hidden" name="id" value={calendar.id} />
            <button class="button-secondary min-h-11" type="submit"
              >{$t("calendar.revoke")}</button
            >
          </form>
        {/each}
      </section>
    {/if}
  </svelte:fragment>
</FeaturePage>
