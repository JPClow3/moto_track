<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import MetricCard from "$components/MetricCard.svelte";
  import { t, locale, format } from "$lib/i18n/store";
  import { adminMessages, adminText, adminValue } from "$lib/i18n/admin";
  export let data;
  export let form;

  $: copy = adminMessages($locale);

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
          ? copy.operationComplete
          : String(
              "data" in result && result.data?.message
                ? result.data.message
                : copy.operationFailed,
            );
      await update();
    };
  };
</script>

<svelte:head><title>{copy.pageTitle}</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <div>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>{copy.admin}
    </p>
    <h1 class="display text-4xl">{copy.consoleTitle}</h1>
    <p class="mt-2 text-sm text-[var(--muted)]">{copy.description}</p>
  </div>

  {#if form?.message}
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
    >
      {form.message}
    </div>
  {/if}

  {#if statusMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
    </p>
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
        <p class="rounded border border-warning/30 bg-warning/10 p-3 text-sm">
          {copy.workerUnavailable}
        </p>
      {:else}
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded border border-[var(--line)] p-3">
            <h3 class="text-sm font-semibold">{copy.r2Queue}</h3>
            <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
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

          <div class="rounded border border-[var(--line)] p-3">
            <h3 class="text-sm font-semibold">{copy.latestRun}</h3>
            {#if data.workerOperations.recentRuns[0]}
              {@const run = data.workerOperations.recentRuns[0]}
              <p class="mt-2 text-sm">
                {adminValue($locale, "origin", run.trigger_source)}
                · {adminValue($locale, "status", run.status)} · {$format.date(
                  run.started_at,
                  { dateStyle: "short", timeStyle: "short" },
                )}
              </p>
              {#if run.failure_codes.length}
                <p class="mt-1 text-sm text-danger">
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

        <div class="rounded border border-[var(--line)] p-3">
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
                { dateStyle: "short", timeStyle: "short" },
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
          <summary class="cursor-pointer text-sm font-medium"
            >{copy.recentRuns}</summary
          >
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="text-xs text-[var(--muted)]">
                  <th class="py-1 pr-4 font-medium">{copy.started}</th>
                  <th class="py-1 pr-4 font-medium">{copy.origin}</th>
                  <th class="py-1 pr-4 font-medium">{copy.status}</th>
                  <th class="py-1 pr-4 font-medium">{copy.due}</th>
                  <th class="py-1 pr-4 font-medium">{copy.deletions}</th>
                  <th class="py-1 font-medium">{copy.failures}</th>
                </tr>
              </thead>
              <tbody>
                {#each data.workerOperations.recentRuns as run (run.started_at)}
                  <tr class="border-t border-[var(--line)]">
                    <td class="py-1.5 pr-4">
                      {$format.date(run.started_at, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td class="py-1.5 pr-4">
                      {adminValue($locale, "origin", run.trigger_source)}
                    </td>
                    <td class="py-1.5 pr-4"
                      >{adminValue($locale, "status", run.status)}</td
                    >
                    <td class="py-1.5 pr-4">
                      {run.reminders_due ?? "—"}
                      ({run.reminders_emailed ?? 0} email /
                      {run.reminders_pushed ?? 0} push)
                    </td>
                    <td class="py-1.5 pr-4">
                      {run.deletions_succeeded ?? 0}/{run.deletions_attempted ??
                        0} ({run.deletions_failed ?? 0}
                      {copy.failureCount})
                    </td>
                    <td class="py-1.5">
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
                    <td colspan="6" class="py-4 text-center text-[var(--muted)]"
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
        <label class="field-label" for="admin-company">{copy.company}</label>
        <input
          class="field"
          id="admin-company"
          name="company_name"
          value={data.settings?.company_name ?? "Moto Track"}
        />
        <label class="field-label" for="admin-support-email"
          >{copy.supportEmail}</label
        >
        <input
          class="field"
          id="admin-support-email"
          name="support_email"
          value={data.settings?.support_email ?? ""}
          placeholder={copy.supportEmailPlaceholder}
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="admin-support-phone"
              >{copy.phone}</label
            >
            <input
              class="field"
              id="admin-support-phone"
              name="support_phone"
              value={data.settings?.support_phone ?? ""}
              placeholder={copy.phone}
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
              value={data.settings?.support_whatsapp ?? ""}
              placeholder={copy.whatsapp}
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
              placeholder={copy.city}
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-state">{copy.state}</label>
            <input
              class="field"
              id="admin-state"
              name="address_state"
              value={data.settings?.address_state ?? ""}
              placeholder={copy.state}
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
              placeholder={copy.dpo}
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
              value={data.settings?.dpo_email ?? ""}
              placeholder={copy.dpoEmail}
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
        <label class="field-label" for="article-title">{copy.title}</label>
        <input
          class="field"
          id="article-title"
          name="title"
          placeholder={copy.title}
          required
        />
        <label class="field-label" for="article-slug">{copy.slug}</label>
        <input
          class="field"
          id="article-slug"
          name="slug"
          placeholder={copy.slugPlaceholder}
        />
        <label class="field-label" for="article-summary">{copy.summary}</label>
        <input
          class="field"
          id="article-summary"
          name="summary"
          placeholder={copy.summary}
          required
        />
        <label class="field-label" for="article-body">{copy.body}</label>
        <textarea
          class="field min-h-32"
          id="article-body"
          name="body"
          placeholder={copy.body}
          required
        ></textarea>
        <label class="flex items-center gap-2 text-sm" for="article-published"
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
            <input
              class="field"
              id="template-brand"
              name="brand"
              placeholder={copy.brand}
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-model">{copy.model}</label>
            <input
              class="field"
              id="template-model"
              name="model"
              placeholder={copy.model}
              required
            />
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
              placeholder={copy.firstYear}
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
              placeholder={copy.lastYear}
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
        <label class="field-label" for="template-variant">{copy.variant}</label>
        <input
          class="field"
          id="template-variant"
          name="variant"
          placeholder={copy.variantPlaceholder}
        />
        <p class="text-xs text-[var(--muted)]">{copy.templateHidden}</p>
        <button class="button-secondary" type="submit" disabled={formBusy}
          >{copy.createTemplate}</button
        >
      </form>

      <div class="panel p-4">
        <h2 class="display text-xl">{copy.dataRequests}</h2>
        <div class="mt-3 grid gap-2 text-sm">
          {#each data.requests as request}
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-2"
            >
              <span>
                {adminValue($locale, "request", request.request_type)} · {adminValue(
                  $locale,
                  "status",
                  request.status,
                )} · {$format.date(String(request.created_at), {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
              {#if request.status === "open"}
                <form
                  method="POST"
                  action="?/fulfillDataRequest"
                  use:enhance={enhanceWithStatus}
                >
                  <input type="hidden" name="id" value={request.id} />
                  <button
                    class="button-secondary px-3 py-1.5 text-xs"
                    disabled={formBusy}
                    type="submit">{copy.markFulfilled}</button
                  >
                </form>
              {/if}
            </div>
          {:else}
            <p class="text-[var(--muted)]">{copy.noRequests}</p>
          {/each}
        </div>
      </div>

      <div class="panel p-4 xl:col-span-2">
        <h2 class="display text-xl">{copy.sourcesTitle}</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">{copy.sourceMethod}</p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-[var(--muted)]">
                <th class="py-1 pr-4 font-medium">{copy.model}</th>
                <th class="py-1 pr-4 font-medium">{copy.years}</th>
                <th class="py-1 pr-4 font-medium">{copy.document}</th>
                <th class="py-1 pr-4 font-medium">{copy.verifiedAt}</th>
                <th class="py-1 font-medium">{copy.items}</th>
              </tr>
            </thead>
            <tbody>
              {#each data.manualSources as source}
                <tr class="border-t border-[var(--line)]">
                  <td class="py-1.5 pr-4">
                    {source.brand}
                    {source.model}
                    {source.variant}
                    {#if source.is_exact_schedule}
                      <span
                        class="label-tech ml-1 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]"
                        >{copy.exact}</span
                      >
                    {/if}
                  </td>
                  <td class="py-1.5 pr-4">
                    {source.year_from}–{source.year_to ?? source.year_from}
                  </td>
                  <td class="py-1.5 pr-4">{source.document_version}</td>
                  <td class="py-1.5 pr-4">{source.last_verified_date}</td>
                  <td
                    class="py-1.5 {source.maintenance_count === 0
                      ? 'font-semibold text-danger'
                      : ''}"
                  >
                    {source.maintenance_count}
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="5" class="py-4 text-center text-[var(--muted)]"
                    >{copy.noSources}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</section>
