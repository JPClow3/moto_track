<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import type { StatusTone } from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { VehicleDocument } from "$components/icons";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { t, locale } from "$lib/i18n/store";
  import { formatDate, type MessageKey } from "$lib/i18n";
  import { dateOnlyValue } from "$lib/utils/feature-values";
  export let data;
  export let form;

  $: hasMotorcycles = data.motorcycles.length > 0;
  // The feature config ships English infrastructure copy ("R2-backed files");
  // override it with the localized page identity like /reminders does.
  $: localizedFeature = {
    ...data.feature,
    title: $t("documents.pageTitle"),
    subtitle: $t("documents.pageSubtitle"),
  };

  // Expired paperwork is critical (red); the server sorted it to the top.
  const VALIDITY: Record<string, { tone: StatusTone; key: MessageKey }> = {
    overdue: { tone: "overdue", key: "recordsUx.docExpired" },
    due_soon: { tone: "due", key: "recordsUx.docExpiringSoon" },
    ok: { tone: "ok", key: "recordsUx.docValid" },
    unknown: { tone: "neutral", key: "recordsUx.docNoExpiry" },
  };

  // Rows are reloaded on a locale switch, so labels re-render with them.
  const validityFor = (row: Record<string, unknown>) => {
    const validity = VALIDITY[String(row.urgency ?? "")];
    return validity ? { tone: validity.tone, label: $t(validity.key) } : null;
  };

  let formBusy = false;
  let errorStatus = "";

  const enhanceReminder: SubmitFunction = () => {
    formBusy = true;
    errorStatus = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        showToast($t("documents.reminderCreated"), {
          action: { label: $t("dashboard.viewReminders"), href: "/reminders" },
        });
      } else {
        errorStatus = String(
          "data" in result && result.data?.message
            ? result.data.message
            : $t("documents.reminderFailed"),
        );
      }
      await update();
    };
  };

  const validUntilLabel = (value: unknown) => {
    const day = dateOnlyValue(value);
    return day
      ? $t("documents.validUntil", { date: formatDate($locale, day) })
      : $t("documents.noValidity");
  };
</script>

<svelte:head
  ><title>{$t("documents.pageTitle")} · Moto Track</title></svelte:head
>

<section aria-busy={formBusy}>
  <FeaturePage
    routeSlug="documents"
    feature={localizedFeature}
    rows={data.rows}
    motorcycles={data.motorcycles}
    errorMessage={!form?.ok
      ? form?.message || data.errorMessage
      : data.errorMessage}
    emptyIcon={VehicleDocument}
    emptyTitle={$t("recordsUx.documentsEmpty")}
    rowStatus={validityFor}
  />
  {#if errorStatus}
    <p
      class="mt-6 rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
      aria-live="assertive"
    >
      {errorStatus}
    </p>
  {/if}
  {#if hasMotorcycles && data.rows.length > 0}
    <!-- One purpose for this second list: turning expiry dates into reminders.
         It used to repeat every document with no explanation of why. -->
    <section class="panel mt-6 p-5">
      <h2 class="display text-xl">{$t("documents.reminderHeading")}</h2>
      <p class="mt-1 text-sm text-[var(--muted)]">
        {$t("documents.reminderHint")}
      </p>
      <ul class="mt-4 grid gap-2 md:grid-cols-2">
        {#each data.rows as document (document.id)}
          <li
            class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-[var(--line)] p-3"
          >
            <span class="flex min-w-0 flex-1 items-start gap-3">
              <VehicleDocument
                size={20}
                class="mt-0.5 shrink-0 text-[var(--muted)]"
              />
              <span class="min-w-0 break-words text-sm">
                {document.name}
                <span class="block text-xs text-[var(--muted)]">
                  {validUntilLabel(document.valid_until)}
                </span>
              </span>
            </span>
            {#if document.valid_until}
              <form
                method="POST"
                action="?/createReminder"
                use:enhance={enhanceReminder}
              >
                <input type="hidden" name="id" value={String(document.id)} />
                <button
                  class="button-secondary min-h-11 px-3 py-1 text-xs"
                  disabled={formBusy}
                >
                  {$t("documents.createReminder")}
                </button>
              </form>
            {/if}
          </li>
        {/each}
      </ul>
      <a
        class="mt-4 inline-block text-sm font-semibold text-[var(--fg)] underline underline-offset-4 hover:decoration-2"
        href="/reminders">{$t("dashboard.viewReminders")} →</a
      >
    </section>
  {/if}
</section>
