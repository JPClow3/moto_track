<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import MetricCard from "$components/MetricCard.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { t, locale, format } from "$lib/i18n/store";
  import { adminMessages, adminText, adminValue } from "$lib/i18n/admin";
  export let data;
  export let form;

  $: copy = adminMessages($locale);

  let formBusy = false;
  let errorMessage = "";

  // Success confirms with a toast; only failures stay inline.
  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    errorMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        showToast(copy.operationComplete);
      } else {
        errorMessage = String(
          "data" in result && result.data?.message
            ? result.data.message
            : copy.operationFailed,
        );
      }
      await update();
    };
  };

  const thClass = "label-tech px-3 py-2 font-semibold text-[var(--muted)]";
  const tdClass = "px-3 py-2";
  const shortDateTime: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };
</script>

<svelte:head><title>{copy.pageTitle}</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <header class="border-b border-[var(--line)] pb-5 pt-1">
    <h1 class="display text-3xl sm:text-4xl">{copy.consoleTitle}</h1>
    <p class="mt-1.5 text-sm text-[var(--muted)]">{copy.description}</p>
  </header>

  {#if form?.message || errorMessage}
    <div
      class="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
      aria-live="assertive"
    >
      {errorMessage || form?.message}
    </div>
  {/if}

  {#if !data.isStaff}
    <!-- The Admin nav item is now hidden for non-staff, so reaching this means
         typing the URL directly. Says what it means to a person rather than
         narrating our profile schema at them. -->
    <div class="panel p-8 text-center" role="alert">
      <p class="display text-2xl">{$t("admin.notStaffTitle")}</p>
      <p class="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
        {$t("admin.notStaffBody")}
      </p>
      <a class="button-secondary mt-6" href="/dashboard"
        >{$t("error.backToDashboard")}</a
      >
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-4">
      <MetricCard
        label={copy.users}
        value={$format.number(data.counts.users ?? 0)}
      />
      <MetricCard
        label={copy.articles}
        value={$format.number(data.counts.articles ?? 0)}
      />
      <MetricCard
        label={copy.billingEvents}
        value={$format.number(data.counts.events ?? 0)}
      />
      <MetricCard
        label={copy.dataRequestsMetric}
        value={$format.number(data.counts.requests ?? 0)}
      />
    </div>

    <section class="panel grid gap-4 p-4" aria-labelledby="worker-ops-heading">
      <div>
        <h2 id="worker-ops-heading" class="display text-xl">
          {copy.workerTitle}
        </h2>
        <p class="mt-1 text-sm text-[var(--muted)]">{copy.workerDescription}</p>
      </div>

      {#if !data.workerOperations.available}
        <p
          class="rounded-md border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm"
        >
          {copy.workerUnavailable}
        </p>
      {:else}
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-md border border-[var(--line)] p-3">
            <h3 class="text-sm font-semibold">{copy.r2Queue}</h3>
            <dl class="numeric mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt class="text-[var(--muted)]">{copy.queued}</dt>
              <dd>{data.workerOperations.deletionBacklog?.queued ?? 0}</dd>
              <dt class="text-[var(--muted)]">{copy.readyToRetry}</dt>
              <dd>{data.workerOperations.deletionBacklog?.due_now ?? 0}</dd>
              <dt class="text-[var(--muted)]">{copy.highestAttempts}</dt>
              <dd>
                {data.workerOperations.deletionBacklog?.highest_attempt_count ??
                  0}
              </dd>
              <dt class="text-[var(--muted)]">{copy.oldestAge}</dt>
              <dd>
                {#if data.workerOperations.deletionBacklog?.oldest_item_age_seconds != null}
                  {Math.floor(
                    data.workerOperations.deletionBacklog
                      .oldest_item_age_seconds / 3600,
                  )}h
                {:else}
                  —
                {/if}
              </dd>
            </dl>
          </div>

          <div class="rounded-md border border-[var(--line)] p-3">
            <h3 class="text-sm font-semibold">{copy.latestRun}</h3>
            {#if data.workerOperations.recentRuns[0]}
              {@const run = data.workerOperations.recentRuns[0]}
              <p class="mt-2 text-sm">
                {adminValue($locale, "origin", run.trigger_source)}
                · {adminValue($locale, "status", run.status)} · {$format.date(
                  run.started_at,
                  shortDateTime,
                )}
              </p>
              {#if run.failure_codes.length}
                <p class="mt-1 text-sm text-[var(--danger)]">
                  {copy.failures}: {run.failure_codes
                    .map((code: string) => adminValue($locale, "failure", code))
                    .join(", ")}
                </p>
              {/if}
              <p class="mt-1 text-xs text-[var(--muted)]">
                {adminText($locale, "runSummary", {
                  emailed: $format.number(run.reminders_emailed ?? 0),
                  pushed: $format.number(run.reminders_pushed ?? 0),
                  deleted: $format.number(run.deletions_succeeded ?? 0),
                  attempted: $format.number(run.deletions_attempted ?? 0),
                })}
              </p>
            {:else}
              <p class="mt-2 text-sm text-[var(--muted)]">{copy.noRuns}</p>
            {/if}
          </div>
        </div>

        <div class="rounded-md border border-[var(--line)] p-3">
          <h3 class="text-sm font-semibold">{copy.cronTitle}</h3>
          <p class="mt-2 text-sm">
            {copy.referenceTime} ·
            {new Date(data.workerOperations.expectedLatestScheduledSlotAt)
              .toISOString()
              .slice(0, 10)}
          </p>
          {#if data.workerOperations.latestScheduledRun}
            <p class="mt-1 text-sm">
              {copy.lastRecorded}
              {$format.date(
                data.workerOperations.latestScheduledRun.started_at,
                shortDateTime,
              )}
              · {adminValue(
                $locale,
                "status",
                data.workerOperations.latestScheduledRun.status,
              )}
            </p>
          {:else}
            <p class="mt-1 text-sm text-[var(--muted)]">{copy.noCronRuns}</p>
          {/if}
          <p
            class="mt-1 text-sm"
            class:text-warning={!data.workerOperations
              .latestScheduledSlotRecorded}
          >
            {data.workerOperations.latestScheduledSlotRecorded
              ? copy.slotRecorded
              : copy.slotMissing}
          </p>
          <p class="mt-1 text-xs text-[var(--muted)]">{copy.slotMethod}</p>
        </div>

        <details>
          <summary
            class="focus-ring flex min-h-11 cursor-pointer items-center rounded text-sm font-semibold"
            >{copy.recentRuns}</summary
          >
          <div class="data-table mt-2 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead
                class="border-y border-[var(--line)] bg-[var(--panel-sunken)]"
              >
                <tr>
                  <th class={thClass} scope="col">{copy.started}</th>
                  <th class={thClass} scope="col">{copy.origin}</th>
                  <th class={thClass} scope="col">{copy.status}</th>
                  <th class={thClass} scope="col">{copy.due}</th>
                  <th class={thClass} scope="col">{copy.deletions}</th>
                  <th class={thClass} scope="col">{copy.failures}</th>
                </tr>
              </thead>
              <tbody>
                {#each data.workerOperations.recentRuns as run (run.started_at)}
                  <tr class="border-b border-[var(--line)]">
                    <td class="{tdClass} numeric" data-label={copy.started}>
                      {$format.date(run.started_at, shortDateTime)}
                    </td>
                    <td class={tdClass} data-label={copy.origin}>
                      {adminValue($locale, "origin", run.trigger_source)}
                    </td>
                    <td class={tdClass} data-label={copy.status}
                      >{adminValue($locale, "status", run.status)}</td
                    >
                    <td class="{tdClass} numeric" data-label={copy.due}>
                      {run.reminders_due ?? "—"}
                      ({run.reminders_emailed ?? 0} email /
                      {run.reminders_pushed ?? 0} push)
                    </td>
                    <td class="{tdClass} numeric" data-label={copy.deletions}>
                      {run.deletions_succeeded ?? 0}/{run.deletions_attempted ??
                        0} ({run.deletions_failed ?? 0}
                      {copy.failureCount})
                    </td>
                    <td class={tdClass} data-label={copy.failures}>
                      {run.failure_codes.length
                        ? run.failure_codes
                            .map((code: string) =>
                              adminValue($locale, "failure", code),
                            )
                            .join(", ")
                        : "—"}
                    </td>
                  </tr>
                {:else}
                  <tr>
                    <td
                      colspan="6"
                      class="px-3 py-4 text-center text-[var(--muted)]"
                      >{copy.noRuns}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>
        <p class="text-xs text-[var(--muted)]">{copy.workerRunbook}</p>
      {/if}
    </section>

    <div class="grid gap-6 xl:grid-cols-2">
      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/saveSettings"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">{copy.siteSettings}</h2>
        <div class="field-group">
          <label class="field-label" for="admin-company">{copy.company}</label>
          <input
            class="field"
            id="admin-company"
            name="company_name"
            value={data.settings?.company_name ?? "Moto Track"}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="admin-support-email"
            >{copy.supportEmail}</label
          >
          <input
            class="field"
            id="admin-support-email"
            name="support_email"
            type="email"
            value={data.settings?.support_email ?? ""}
            placeholder={copy.supportEmailPlaceholder}
          />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="admin-support-phone"
              >{copy.phone}</label
            >
            <input
              class="field"
              id="admin-support-phone"
              name="support_phone"
              type="tel"
              value={data.settings?.support_phone ?? ""}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-support-whatsapp"
              >{copy.whatsapp}</label
            >
            <input
              class="field"
              id="admin-support-whatsapp"
              name="support_whatsapp"
              type="tel"
              value={data.settings?.support_whatsapp ?? ""}
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="admin-city">{copy.city}</label>
            <input
              class="field"
              id="admin-city"
              name="address_city"
              value={data.settings?.address_city ?? ""}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-state">{copy.state}</label>
            <input
              class="field"
              id="admin-state"
              name="address_state"
              value={data.settings?.address_state ?? ""}
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="admin-dpo-name">{copy.dpo}</label>
            <input
              class="field"
              id="admin-dpo-name"
              name="dpo_name"
              value={data.settings?.dpo_name ?? ""}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-dpo-email"
              >{copy.dpoEmail}</label
            >
            <input
              class="field"
              id="admin-dpo-email"
              name="dpo_email"
              type="email"
              value={data.settings?.dpo_email ?? ""}
            />
          </div>
        </div>
        <button class="button-primary" type="submit" disabled={formBusy}
          >{copy.save}</button
        >
      </form>

      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/createArticle"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">{copy.newArticle}</h2>
        <div class="field-group">
          <label class="field-label" for="article-title">{copy.title}</label>
          <input class="field" id="article-title" name="title" required />
        </div>
        <div class="field-group">
          <label class="field-label" for="article-slug">{copy.slug}</label>
          <input
            class="field"
            id="article-slug"
            name="slug"
            placeholder={copy.slugPlaceholder}
          />
        </div>
        <div class="field-group">
          <label class="field-label" for="article-summary">{copy.summary}</label
          >
          <input class="field" id="article-summary" name="summary" required />
        </div>
        <div class="field-group">
          <label class="field-label" for="article-body">{copy.body}</label>
          <textarea
            class="field min-h-32"
            id="article-body"
            name="body"
            required
          ></textarea>
        </div>
        <label
          class="flex min-h-11 items-center gap-2 text-sm font-semibold"
          for="article-published"
          ><input
            id="article-published"
            type="checkbox"
            name="is_published"
            value="true"
            checked
          />{copy.published}</label
        >
        <button class="button-primary" type="submit" disabled={formBusy}
          >{copy.publish}</button
        >
      </form>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/createTemplate"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">{copy.motorcycleTemplate}</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="template-brand">{copy.brand}</label>
            <input class="field" id="template-brand" name="brand" required />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-model">{copy.model}</label>
            <input class="field" id="template-model" name="model" required />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-4">
          <div class="field-group">
            <label class="field-label" for="template-year-from"
              >{copy.firstYear}</label
            >
            <input
              class="field"
              id="template-year-from"
              name="year_from"
              type="number"
              inputmode="numeric"
              step="1"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-year-to"
              >{copy.lastYear}</label
            >
            <input
              class="field"
              id="template-year-to"
              name="year_to"
              type="number"
              inputmode="numeric"
              step="1"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-engine"
              >{copy.engine}</label
            >
            <input
              class="field"
              id="template-engine"
              name="engine_cc"
              type="number"
              inputmode="numeric"
              step="1"
              placeholder="cc"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-country"
              >{copy.country}</label
            >
            <input
              class="field"
              id="template-country"
              name="country_code"
              value="BR"
            />
          </div>
        </div>
        <div class="field-group">
          <label class="field-label" for="template-variant"
            >{copy.variant}</label
          >
          <input
            class="field"
            id="template-variant"
            name="variant"
            placeholder={copy.variantPlaceholder}
          />
          <p class="field-help">{copy.templateHidden}</p>
        </div>
        <button class="button-secondary" type="submit" disabled={formBusy}
          >{copy.createTemplate}</button
        >
      </form>

      <section class="panel overflow-hidden" aria-labelledby="admin-requests">
        <h2 class="display px-4 pb-3 pt-4 text-xl" id="admin-requests">
          {copy.dataRequests}
        </h2>
        {#if data.requests.length}
          <div class="data-table">
            <table class="w-full text-left text-sm">
              <thead
                class="border-y border-[var(--line)] bg-[var(--panel-sunken)]"
              >
                <tr>
                  <th class={thClass} scope="col">{copy.requestType}</th>
                  <th class={thClass} scope="col">{copy.status}</th>
                  <th class={thClass} scope="col">{copy.requestedAt}</th>
                  <th class={thClass} scope="col"
                    ><span class="sr-only">{$t("common.actions")}</span></th
                  >
                </tr>
              </thead>
              <tbody>
                {#each data.requests as request (request.id)}
                  <tr class="border-b border-[var(--line)] last:border-b-0">
                    <td class={tdClass} data-label={copy.requestType}
                      >{adminValue(
                        $locale,
                        "request",
                        request.request_type,
                      )}</td
                    >
                    <td class={tdClass} data-label={copy.status}
                      ><StatusBadge
                        tone={request.status === "open"
                          ? "info"
                          : request.status === "fulfilled"
                            ? "ok"
                            : "neutral"}
                        >{adminValue(
                          $locale,
                          "status",
                          request.status,
                        )}</StatusBadge
                      ></td
                    >
                    <td class="{tdClass} numeric" data-label={copy.requestedAt}
                      >{$format.date(
                        String(request.created_at),
                        shortDateTime,
                      )}</td
                    >
                    <td class="{tdClass} text-right">
                      {#if request.status === "open"}
                        <form
                          method="POST"
                          action="?/fulfillDataRequest"
                          use:enhance={enhanceWithStatus}
                        >
                          <input type="hidden" name="id" value={request.id} />
                          <button
                            class="button-secondary"
                            disabled={formBusy}
                            type="submit">{copy.markFulfilled}</button
                          >
                        </form>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p
            class="border-t border-[var(--line)] px-4 py-4 text-sm text-[var(--muted)]"
          >
            {copy.noRequests}
          </p>
        {/if}
      </section>

      <section
        class="panel overflow-hidden xl:col-span-2"
        aria-labelledby="admin-sources"
      >
        <div class="px-4 pb-3 pt-4">
          <h2 class="display text-xl" id="admin-sources">
            {copy.sourcesTitle}
          </h2>
          <p class="mt-1 text-sm text-[var(--muted)]">{copy.sourceMethod}</p>
        </div>
        <div class="data-table overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead
              class="border-y border-[var(--line)] bg-[var(--panel-sunken)]"
            >
              <tr>
                <th class={thClass} scope="col">{copy.model}</th>
                <th class={thClass} scope="col">{copy.years}</th>
                <th class={thClass} scope="col">{copy.document}</th>
                <th class={thClass} scope="col">{copy.verifiedAt}</th>
                <th class="{thClass} text-right" scope="col">{copy.items}</th>
              </tr>
            </thead>
            <tbody>
              {#each data.manualSources as source}
                <tr class="border-b border-[var(--line)] last:border-b-0">
                  <td class={tdClass} data-label={copy.model}>
                    <span class="inline-flex flex-wrap items-center gap-2">
                      <span
                        >{source.brand}
                        {source.model}
                        {source.variant}</span
                      >
                      {#if source.is_exact_schedule}
                        <StatusBadge tone="ok">{copy.exact}</StatusBadge>
                      {/if}
                    </span>
                  </td>
                  <td class="{tdClass} numeric" data-label={copy.years}>
                    {source.year_from}–{source.year_to ?? source.year_from}
                  </td>
                  <td class={tdClass} data-label={copy.document}
                    >{source.document_version}</td
                  >
                  <td class="{tdClass} numeric" data-label={copy.verifiedAt}
                    >{source.last_verified_date}</td
                  >
                  <td
                    class="{tdClass} numeric text-right {source.maintenance_count ===
                    0
                      ? 'font-semibold text-[var(--warning)]'
                      : ''}"
                    data-label={copy.items}
                  >
                    {source.maintenance_count}
                  </td>
                </tr>
              {:else}
                <tr>
                  <td
                    colspan="5"
                    class="px-3 py-4 text-center text-[var(--muted)]"
                    >{copy.noSources}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  {/if}
</section>
