<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import type { StatusTone } from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import Bell from "lucide-svelte/icons/bell";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { t } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { onMount } from "svelte";
  export let data;
  export let form;

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: hasReminders = data.rows.length > 0;
  $: localizedFeature = {
    ...data.feature,
    title: $t("reminders.pageTitle"),
    subtitle: $t("reminders.pageSubtitle"),
  };

  // Overdue is the one legitimate red in the app body; the server already
  // sorted the rows so the most urgent come first.
  const STATUS: Record<string, { tone: StatusTone; key: MessageKey }> = {
    overdue: { tone: "overdue", key: "recordsUx.statusOverdue" },
    due_soon: { tone: "due", key: "recordsUx.statusDueSoon" },
    ok: { tone: "ok", key: "recordsUx.statusOk" },
    unknown: { tone: "neutral", key: "recordsUx.statusUnknown" },
    inactive: { tone: "neutral", key: "recordsUx.statusPaused" },
  };

  // Rows are reloaded on a locale switch, so labels re-render with them.
  const reminderStatus = (row: Record<string, unknown>) => {
    if (row.snoozed === true)
      return { tone: "info" as const, label: $t("recordsUx.statusSnoozed") };
    const status = STATUS[String(row.urgency ?? "")];
    return status ? { tone: status.tone, label: $t(status.key) } : null;
  };

  // Due maintenance shares this list's statuses: red overdue, amber due and a
  // neutral "a confirmar" for history the rider could not state.
  const MAINTENANCE_TONE: Record<
    string,
    { tone: StatusTone; key: MessageKey }
  > = {
    overdue: { tone: "overdue", key: "dashboard.statusOverdue" },
    due: { tone: "due", key: "dashboard.statusDueSoon" },
    confirm: { tone: "neutral", key: "dashboard.statusConfirm" },
  };
  $: maintenanceDue = data.maintenanceDue ?? [];
  $: showBikeNames =
    new Set(maintenanceDue.map((item) => item.motorcycleId)).size > 1;

  // Collapsed by default; opened by Conta's #calendar link, and kept open
  // while a newly created subscription URL is on screen.
  let calendarOpen = false;
  $: if (form?.calendarUrl) calendarOpen = true;
  onMount(() => {
    if (location.hash === "#calendar") calendarOpen = true;
  });

  const enhanceCalendar =
    (successKey: MessageKey): SubmitFunction =>
    () =>
    async ({ result, update }) => {
      if (result.type === "success") showToast($t(successKey));
      await update();
    };
</script>

<svelte:head
  ><title>{$t("reminders.pageTitle")} · Moto Track</title></svelte:head
>

{#if !hasMotorcycles && hasReminders}
  <!-- With no reminders FeaturePage's empty state already points to the
       garage; this note only covers reminders left over without a bike. -->
  <div
    class="mb-6 flex flex-col gap-3 rounded border border-[var(--line)] bg-[var(--info-soft)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    role="status"
    aria-live="polite"
  >
    <span class="text-[var(--fg)]">{$t("reminders.noMotorcyclesHint")}</span>
    <a class="button-secondary min-h-11 shrink-0" href="/garage"
      >{$t("reminders.goToGarage")}</a
    >
  </div>
{/if}

<FeaturePage
  routeSlug="reminders"
  feature={localizedFeature}
  rows={data.rows}
  motorcycles={data.motorcycles}
  errorMessage={form?.message || data.errorMessage}
  emptyIcon={Bell}
  emptyTitle={maintenanceDue.length
    ? $t("reminders.emptyBesidesMaintenance")
    : $t("recordsUx.remindersEmpty")}
  rowStatus={reminderStatus}
>
  <svelte:fragment slot="lead">
    {#if maintenanceDue.length}
      <section class="panel p-5" aria-labelledby="due-maintenance-heading">
        <div class="flex items-center justify-between gap-3">
          <h2
            id="due-maintenance-heading"
            class="label-tech text-[var(--muted)]"
          >
            {$t("reminders.maintenanceHeading")}
          </h2>
          <a
            class="focus-ring flex min-h-11 items-center rounded text-sm font-semibold text-[var(--fg)] underline underline-offset-4"
            href="/maintenance">{$t("reminders.openMaintenance")}</a
          >
        </div>
        <ul class="divide-y divide-[var(--line)]">
          {#each maintenanceDue as item (item.id)}
            {@const status = MAINTENANCE_TONE[item.tone]}
            <li>
              <a
                href={item.href}
                class="focus-ring flex min-h-11 items-center justify-between gap-3 rounded py-3"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold"
                    >{item.title}</span
                  >
                  {#if showBikeNames}
                    <span class="block text-xs text-[var(--muted)]"
                      >{item.motorcycleName}</span
                    >
                  {/if}
                </span>
                <span class="flex shrink-0 items-center gap-2">
                  <StatusBadge tone={status.tone}>{$t(status.key)}</StatusBadge>
                  <ChevronRight
                    size={16}
                    class="text-[var(--muted)]"
                    aria-hidden="true"
                  />
                </span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </svelte:fragment>
</FeaturePage>

{#if hasReminders || data.calendars.length > 0}
  <!-- Set-once calendar sync: collapsed, so the list stays the page. Conta
       links here (#calendar). -->
  <details
    id="calendar"
    class="group/calendar panel mt-6 p-5"
    bind:open={calendarOpen}
  >
    <summary
      class="focus-ring flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded"
    >
      <h2 id="calendar-heading" class="text-base font-semibold">
        {$t("calendar.heading")}
      </h2>
      <ChevronDown
        size={20}
        class="shrink-0 text-[var(--muted)] transition-transform duration-200 group-open/calendar:rotate-180"
      />
    </summary>
    <div class="mt-3 grid gap-4">
      <p class="text-sm text-[var(--muted)]">{$t("calendar.help")}</p>
      <div class="flex flex-wrap gap-3">
        <a class="button-secondary" href="/reminders/calendar.ics"
          >{$t("calendar.download")}</a
        >
        <form
          method="POST"
          action="?/createCalendar"
          use:enhance={enhanceCalendar("recordsUx.calendarCreated")}
        >
          <button class="button-primary" type="submit"
            >{$t("calendar.create")}</button
          >
        </form>
      </div>
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
            on:focus={(event) => event.currentTarget.select()}
          />
          <p class="text-sm text-[var(--muted)]">{$t("calendar.secret")}</p>
        </div>
      {/if}
      {#each data.calendars as calendar (calendar.id)}
        <form
          class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
          method="POST"
          action="?/revokeCalendar"
          use:enhance={enhanceCalendar("recordsUx.calendarRevoked")}
        >
          <span class="numeric text-sm"
            >{calendar.token_prefix}… · {$t("calendar.expires")}: {calendar.expires_at.slice(
              0,
              10,
            )}</span
          >
          <input type="hidden" name="id" value={calendar.id} />
          <button class="button-danger" type="submit"
            >{$t("calendar.revoke")}</button
          >
        </form>
      {/each}
    </div>
  </details>
{/if}
