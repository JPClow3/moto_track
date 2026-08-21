<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { t } from "$lib/i18n/store";
  export let data;
  export let form;

  $: hasMotorcycles = data.motorcycles.length > 0;
  // The feature config ships English infrastructure copy ("R2-backed files");
  // override it with the localized page identity like /reminders does.
  $: localizedFeature = {
    ...data.feature,
    slug: $t("nav.documents"),
    title: $t("documents.pageTitle"),
    subtitle: $t("documents.pageSubtitle"),
  };

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      statusRole = result.type === "success" ? "status" : "alert";
      statusMessage =
        result.type === "success"
          ? $t("documents.reminderCreated")
          : String(
              "data" in result && result.data?.message
                ? result.data.message
                : $t("documents.reminderFailed"),
            );
      await update();
    };
  };
</script>

<svelte:head
  ><title>{$t("documents.pageTitle")} · Moto Track</title></svelte:head
>

<section aria-busy={formBusy}>
  <FeaturePage
    feature={localizedFeature}
    rows={data.rows}
    motorcycles={data.motorcycles}
    errorMessage={!form?.ok
      ? form?.message || data.errorMessage
      : data.errorMessage}
  />
  {#if statusMessage}
    <p
      class={statusRole === "alert"
        ? "mt-6 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "mt-6 rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
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
            <span class="min-w-0 flex-1 break-words text-sm">
              {document.name}
              <span class="block text-xs text-[var(--muted)]">
                {document.valid_until
                  ? $t("documents.validUntil", {
                      date: String(document.valid_until),
                    })
                  : $t("documents.noValidity")}
              </span>
            </span>
            <form
              method="POST"
              action="?/createReminder"
              use:enhance={enhanceWithStatus}
            >
              <input type="hidden" name="id" value={String(document.id)} />
              <button
                class="button-secondary min-h-11 px-3 py-1 text-xs"
                disabled={formBusy}
              >
                {$t("documents.createReminder")}
              </button>
            </form>
          </li>
        {/each}
      </ul>
      <a
        class="mt-4 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline"
        href="/reminders">{$t("dashboard.viewReminders")} →</a
      >
    </section>
  {/if}
</section>
