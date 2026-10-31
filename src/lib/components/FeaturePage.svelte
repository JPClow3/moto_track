<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import Download from "lucide-svelte/icons/download";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { createEventDispatcher } from "svelte";
  import { afterNavigate, replaceState } from "$app/navigation";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import PageOverflowMenu from "$lib/components/app/PageOverflowMenu.svelte";
  import ActionMenu, {
    type ActionChoice,
  } from "$lib/components/app/ActionMenu.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge, {
    type StatusTone,
  } from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { Motorcycle } from "$components/icons";
  import type { FeatureConfig, FeatureField } from "$server/domain/features";
  import { t, locale } from "$lib/i18n/store";
  import {
    formatDate,
    formatMoney,
    formatPreciseMoney,
    type MessageKey,
  } from "$lib/i18n";
  import { featureCopy } from "$lib/i18n/feature-copy";
  import { privateFileUrl } from "$lib/utils/private-file-url";
  import { dateOnlyValue, editFieldValue } from "$lib/utils/feature-values";
  import { APP_TIME_ZONE } from "$lib/utils/calendar-day";

  export let routeSlug: string;
  export let addLabel = "";
  export let actionChoices: ActionChoice[] = [];
  export let feature: FeatureConfig;
  export let rows: Array<Record<string, unknown>> = [];
  export let motorcycles: Array<{
    id: string;
    name: string;
    brand: string;
    model: string;
  }> = [];
  export let errorMessage = "";
  export let reminderTrigger = "by_km";
  /** Domain icon and one sentence for the page's empty state. */
  // Lucide icons are still Svelte 4 class components, so accept any component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export let emptyIcon: any = null;
  export let emptyTitle = "";
  /** Optional status pill per row (reminder urgency, document validity). */
  export let rowStatus:
    | ((row: Record<string, unknown>) => {
        tone: StatusTone;
        label: string;
      } | null)
    | null = null;

  const dispatch = createEventDispatcher<{
    actionSelect: string;
  }>();

  let formBusy = false;
  // Only failures stay inline; successes go to a toast, because the sheet
  // closes on success and an inline message was easy to miss.
  let errorStatus = "";

  let createSheet: RecordSheet;
  let editSheet: RecordSheet;
  let actionMenu: ActionMenu;
  let selectedRow: Record<string, unknown> | null = null;
  let editReminderTrigger = "by_km";

  // Every generic record needs a bike when its motorcycle field is required;
  // without one the form cannot be submitted, so point to the garage instead.
  $: needsBike =
    motorcycles.length === 0 &&
    feature.fields.some(
      (field) => field.source === "motorcycles" && field.required,
    );

  export function openCreate() {
    createSheet?.open();
  }

  // Quick-log deep link: /<route>?new=1 opens the "new record" form directly
  // (never the page's chooser), then drops the param so a reload does not
  // reopen it. afterNavigate also catches the global + while already here.
  afterNavigate(({ to }) => {
    const url = to?.url;
    if (!url || url.searchParams.get("new") !== "1") return;
    if (!needsBike) openCreate();
    const clean = new URL(url);
    clean.searchParams.delete("new");
    // The router finishes initialising after the first afterNavigate pass.
    setTimeout(() => {
      try {
        replaceState(`${clean.pathname}${clean.search}${clean.hash}`, {});
      } catch {
        history.replaceState(history.state, "", clean);
      }
    }, 0);
  });

  function handleActionClick() {
    if (actionChoices && actionChoices.length > 0) {
      actionMenu?.open();
    } else {
      openCreate();
    }
  }

  function handleChoiceSelect(event: CustomEvent<string>) {
    const choiceId = event.detail;
    dispatch("actionSelect", choiceId);
    if (choiceId === "create" || choiceId === "expense-record") {
      openCreate();
    }
  }

  function openEdit(row: Record<string, unknown>) {
    selectedRow = row;
    errorStatus = "";
    if (routeSlug === "reminders") {
      editReminderTrigger = String(row.trigger_type ?? "by_km");
    }
    editSheet?.open();
  }

  function isFieldVisible(fieldKey: string, trigger: string): boolean {
    if (routeSlug !== "reminders") return true;

    const isMileage =
      fieldKey === "trigger_value_km" || fieldKey === "reference_km";
    const isDate =
      fieldKey === "trigger_value_days" || fieldKey === "reference_date";
    const isRecurring = fieldKey === "is_recurring";

    if (!isMileage && !isDate && !isRecurring) {
      return true;
    }

    const normalized = (trigger || "").toLowerCase();
    if (normalized === "by_km" || normalized === "mileage") {
      return isMileage;
    }
    if (normalized === "by_date" || normalized === "date") {
      return isDate;
    }
    if (normalized === "by_interval" || normalized === "recurring") {
      return isMileage || isDate || isRecurring;
    }

    return true;
  }

  // The table used to print raw database column names ("fuel_type",
  // "odometer_km") straight into the header. The feature config already carries
  // a human label for every field, so use it and fall back to a de-underscored
  // key.
  function labelForColumn(column: string) {
    return (
      featureCopy(
        $locale,
        feature.fields.find((field) => field.key === column)?.label ?? "",
      ) || column.replaceAll("_", " ")
    );
  }

  function fileHref(row: Record<string, unknown>, key: string) {
    const field = feature.fields.find((item) => item.key === key);
    const value = row[key];
    if (typeof value !== "string" || !value) return null;
    if (field?.kind === "file") return privateFileUrl(value);
    return null;
  }

  function valueFor(row: Record<string, unknown>, key: string) {
    const value = row[key];
    if (value === null || value === undefined || value === "")
      return $t("common.empty");
    if (typeof value === "boolean")
      return value ? $t("common.yes") : $t("common.no");
    const field = feature.fields.find((candidate) => candidate.key === key);
    const day = field?.kind === "date" ? dateOnlyValue(value) : null;
    if (day) return formatDate($locale, day);
    if (
      field?.kind === "datetime" &&
      (typeof value === "string" || value instanceof Date) &&
      Number.isFinite(new Date(value).getTime())
    ) {
      return formatTimestamp(value);
    }
    const option = field?.options?.find(
      (candidate) => candidate.value === value,
    );
    if (option) return featureCopy($locale, option.label);
    if (key.endsWith("_cents") && typeof value === "number") {
      return formatMoney($locale, value);
    }
    if (key.endsWith("_millicents") && typeof value === "number") {
      return formatPreciseMoney($locale, value);
    }
    return String(value);
  }

  // SSR and the browser must use the same calendar day for each instant.
  function formatTimestamp(value: unknown) {
    if (
      (typeof value !== "string" && !(value instanceof Date)) ||
      !Number.isFinite(new Date(value).getTime())
    )
      return $t("common.empty");
    return formatDate($locale, value, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: APP_TIME_ZONE,
    });
  }

  // Number fields that hold fractions. Everything else of kind "number" is a
  // whole count (km, days, year) and keeps the numeric keypad.
  const DECIMAL_NUMBER_KEYS = new Set(["liters", "wear_percent"]);

  function isDecimalField(field: FeatureField) {
    return (
      field.kind === "money" ||
      (field.kind === "number" && DECIMAL_NUMBER_KEYS.has(field.key))
    );
  }

  function isIntegerField(field: FeatureField) {
    return field.kind === "number" && !DECIMAL_NUMBER_KEYS.has(field.key);
  }

  // Decimals are free text so "149,90" can be typed on any keyboard; the
  // server parses it with parseLocalizedNumber.
  const inputType = (field: FeatureField) =>
    field.kind === "date" ? "date" : isIntegerField(field) ? "number" : "text";

  const inputMode = (field: FeatureField): "decimal" | "numeric" | undefined =>
    isDecimalField(field)
      ? "decimal"
      : isIntegerField(field)
        ? "numeric"
        : undefined;

  const decimalPlaceholder = (field: FeatureField) =>
    field.kind === "money" ? ($locale === "en" ? "0.00" : "0,00") : undefined;

  /** Edit prefill in the rider's own decimal separator. */
  function editValue(field: FeatureField, value: unknown) {
    const raw = editFieldValue(field.kind, field.key, value);
    return isDecimalField(field) && $locale !== "en"
      ? raw.replace(".", ",")
      : raw;
  }

  // One dialog for the whole table rather than one per row.
  let confirmDialog: ConfirmDialog;

  function failureMessage(
    result: { type: string; data?: Record<string, unknown> },
    fallback: string,
  ) {
    return result.type === "failure"
      ? String(result.data?.message ?? fallback)
      : fallback;
  }

  const enhanceWithToast =
    (successKey: MessageKey): SubmitFunction =>
    () => {
      formBusy = true;
      errorStatus = "";
      return async ({ result, update }) => {
        formBusy = false;
        if (result.type === "success") {
          showToast($t(successKey));
        } else if (result.type === "failure" || result.type === "error") {
          errorStatus = failureMessage(result, $t("feature.operationFailed"));
        }
        await update();
      };
    };

  const enhanceSheet =
    (
      sheet: () => RecordSheet | undefined,
      successKey: MessageKey,
    ): SubmitFunction =>
    () => {
      formBusy = true;
      errorStatus = "";
      return async ({ result, update }) => {
        formBusy = false;
        if (result.type === "success") {
          await update();
          sheet()?.close();
          showToast($t(successKey));
          return;
        }
        if (result.type === "failure" || result.type === "error") {
          errorStatus = failureMessage(result, $t("feature.operationFailed"));
        }
        await update();
      };
    };

  const enhanceCreate: SubmitFunction = enhanceSheet(
    () => createSheet,
    "recordsUx.saved",
  );
  const enhanceUpdate: SubmitFunction = enhanceSheet(
    () => editSheet,
    "recordsUx.changesSaved",
  );

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask($t("feature.confirmDelete"));
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    errorStatus = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        showToast($t("feature.deleteComplete"));
      } else {
        errorStatus = failureMessage(result, $t("feature.deleteFailed"));
      }
      await update();
    };
  };

  const alertClass =
    "rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]";
</script>

<section class="grid grid-cols-1 gap-6" aria-busy={formBusy}>
  <PageHeader title={feature.title} description={feature.subtitle}>
    <svelte:fragment slot="actions">
      {#if !needsBike}
        <PageAction
          label={addLabel || $t("feature.newRecord")}
          ariaLabel={addLabel || $t("feature.newRecord")}
          on:click={handleActionClick}
        />
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="overflow">
      {#if rows.length > 0}
        <PageOverflowMenu label={$t("authenticatedUx.moreActions")}>
          <a
            class="focus-ring flex items-center gap-2 rounded px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--line)]"
            href={`/${routeSlug}/export.csv`}
          >
            <Download size={16} aria-hidden="true" />
            {$t("common.exportCsv")}
          </a>
        </PageOverflowMenu>
      {/if}
    </svelte:fragment>
  </PageHeader>

  {#if actionChoices && actionChoices.length > 0}
    <ActionMenu
      bind:this={actionMenu}
      title={addLabel || $t("authenticatedUx.addRecord")}
      choices={actionChoices}
      on:select={handleChoiceSelect}
    />
  {/if}

  <ConfirmDialog
    bind:this={confirmDialog}
    confirmLabel={$t("common.delete")}
    destructive
  />

  {#if errorMessage}
    <!-- role="alert" so a screen reader announces the failure instead of it
         only being a coloured box someone has to notice. -->
    <div class={alertClass} role="alert">
      {errorMessage}
    </div>
  {/if}

  {#if errorStatus && errorStatus !== errorMessage}
    <p class={alertClass} role="alert" aria-live="assertive">
      {errorStatus}
    </p>
  {/if}

  <!-- Page-specific content that leads the list (e.g. due maintenance on
       Próximos). -->
  <slot name="lead" />

  {#if rows.length === 0}
    <!-- One designed block instead of an empty table with a header row. -->
    {#if needsBike}
      <EmptyState icon={Motorcycle} title={$t("recordsUx.needsBike")}>
        {#snippet action()}
          <a class="button-primary" href="/garage">{$t("recordsUx.addBike")}</a>
        {/snippet}
      </EmptyState>
    {:else}
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle || $t("recordsUx.recordsEmpty")}
      >
        {#snippet action()}
          <button
            type="button"
            class="button-primary"
            on:click={handleActionClick}
          >
            {addLabel || $t("feature.addFirst")}
          </button>
        {/snippet}
      </EmptyState>
    {/if}
  {:else}
    <div class="panel overflow-hidden">
      <div
        class="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--accent-wash)] px-4 py-2.5"
      >
        <span class="label-tech text-[var(--muted)]"
          >{$t(
            rows.length === 1
              ? "feature.recordCountOne"
              : "feature.recordCountOther",
            { count: rows.length },
          )}</span
        >
      </div>
      <div class="feature-table-scroll data-table overflow-x-auto">
        <table class="feature-table w-full text-left text-sm">
          <caption class="sr-only"
            >{$t("feature.recordsCaption", { feature: feature.title })}</caption
          >
          <thead
            class="border-b border-[var(--line)] bg-[var(--accent-wash)] text-[var(--muted)]"
          >
            <tr>
              {#each feature.listColumns as column, index (column)}
                <th class="label-tech px-4 py-3 text-left" scope="col"
                  >{labelForColumn(column)}</th
                >
                {#if index === 0 && rowStatus}
                  <th class="label-tech px-4 py-3 text-left" scope="col"
                    >{$t("recordsUx.statusColumn")}</th
                  >
                {/if}
              {/each}
              <th class="label-tech px-4 py-3 text-left" scope="col"
                >{$t("feature.updatedAt")}</th
              >
              <th class="label-tech px-4 py-3 text-left" scope="col"
                >{$t("common.actions")}</th
              >
            </tr>
          </thead>
          <tbody>
            {#each rows as row (row.id ?? JSON.stringify(row))}
              {@const status = rowStatus ? rowStatus(row) : null}
              <tr class="row-hover border-b border-[var(--line)]">
                {#each feature.listColumns as column, index (column)}
                  {@const href = fileHref(row, column)}
                  <td class="px-4 py-3" data-label={labelForColumn(column)}>
                    {#if href}
                      <a
                        class="font-medium text-[var(--fg)] underline underline-offset-2 hover:decoration-2"
                        {href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {$t("common.openFile")}
                      </a>
                    {:else}
                      {valueFor(row, column)}
                    {/if}
                  </td>
                  {#if index === 0 && rowStatus}
                    <td
                      class="px-4 py-3"
                      data-label={$t("recordsUx.statusColumn")}
                    >
                      {#if status}
                        <StatusBadge tone={status.tone}
                          >{status.label}</StatusBadge
                        >
                      {:else}
                        {$t("common.empty")}
                      {/if}
                    </td>
                  {/if}
                {/each}
                <td
                  class="numeric px-4 py-3 text-xs text-[var(--muted)]"
                  data-label={$t("feature.updatedAt")}
                >
                  {formatTimestamp(row.updated_at)}
                </td>
                <td
                  class="feature-actions px-4 py-3"
                  data-label={$t("common.actions")}
                >
                  <div class="flex flex-wrap gap-2">
                    {#if (feature.slug === "reminders" || routeSlug === "reminders") && row.is_active !== false}
                      <form
                        method="POST"
                        action="?/snoozeDays"
                        use:enhance={enhanceWithToast(
                          "recordsUx.reminderSnoozed",
                        )}
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={String(row.id ?? "")}
                        />
                        <input type="hidden" name="days" value="7" />
                        <button
                          class="button-secondary min-h-11 px-3 py-1 text-xs"
                          type="submit"
                          disabled={formBusy}
                        >
                          {$t("reminders.snoozeDays")}
                        </button>
                      </form>
                      <form
                        method="POST"
                        action="?/snoozeKm"
                        use:enhance={enhanceWithToast(
                          "recordsUx.reminderSnoozed",
                        )}
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={String(row.id ?? "")}
                        />
                        <input type="hidden" name="km" value="500" />
                        <button
                          class="button-secondary min-h-11 px-3 py-1 text-xs"
                          type="submit"
                          disabled={formBusy}
                        >
                          {$t("reminders.snoozeKm")}
                        </button>
                      </form>
                      <form
                        method="POST"
                        action="?/complete"
                        use:enhance={enhanceWithToast(
                          "recordsUx.reminderCompleted",
                        )}
                      >
                        <input
                          type="hidden"
                          name="completion_version"
                          value={String(row.completion_version ?? 0)}
                        />
                        <input
                          type="hidden"
                          name="id"
                          value={String(row.id ?? "")}
                        />
                        <button
                          class="button-primary min-h-11 px-3 py-1 text-xs"
                          type="submit"
                          disabled={formBusy}
                        >
                          {$t("reminders.complete")}
                        </button>
                      </form>
                    {/if}
                    <button
                      type="button"
                      class="button-secondary min-h-11 px-3 py-1 text-xs"
                      on:click={() => openEdit(row)}
                    >
                      {$t("common.edit")}
                    </button>
                    <!-- Deleting was a single unguarded click with no undo.
                         enhance awaits this callback before it fires the
                         request, so the dialog can gate the submit. -->
                    <form
                      method="POST"
                      action="?/record"
                      use:enhance={enhanceDelete}
                    >
                      <input type="hidden" name="_intent" value="delete" />
                      <input
                        type="hidden"
                        name="id"
                        value={String(row.id ?? "")}
                      />
                      <button
                        class="button-danger min-h-11 px-3 py-1 text-xs"
                        type="submit"
                        disabled={formBusy}
                      >
                        {$t("common.delete")}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <RecordSheet
    bind:this={createSheet}
    title={addLabel || $t("feature.newRecord")}
    description={$t("feature.newRecordHint")}
    closeLabel={$t("authenticatedUx.close") || "Fechar"}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/record"
      enctype="multipart/form-data"
      use:enhance={enhanceCreate}
    >
      <input type="hidden" name="_intent" value="create" />

      {#if errorStatus}
        <p class={alertClass} role="alert">
          {errorStatus}
        </p>
      {/if}

      {#each feature.fields as field (field.key)}
        {#if isFieldVisible(field.key, reminderTrigger)}
          <div class="field-group">
            <label class="field-label" for={`new-${field.key}`}>
              {featureCopy($locale, field.label)}
              {#if field.required}<span
                  class="text-[var(--muted)]"
                  aria-hidden="true">*</span
                >{/if}
            </label>

            {#if field.kind === "textarea"}
              <textarea
                class="field min-h-24"
                id={`new-${field.key}`}
                name={field.key}
                required={field.required}
                aria-describedby={field.help
                  ? `new-${field.key}-help`
                  : undefined}
              ></textarea>
            {:else if field.kind === "boolean"}
              <label class="switch">
                <input
                  type="checkbox"
                  id={`new-${field.key}`}
                  name={field.key}
                  value="true"
                />
                <span class="switch-track" aria-hidden="true"></span>
                <span class="text-sm text-[var(--muted)]"
                  >{$t("common.enabled")}</span
                >
              </label>
            {:else if field.kind === "file"}
              <input
                class="field"
                id={`new-${field.key}`}
                name={field.key}
                type="file"
                accept={routeSlug === "documents"
                  ? "application/pdf,image/avif,image/gif,image/jpeg,image/png,image/webp"
                  : undefined}
                required={field.required}
              />
            {:else if field.kind === "select"}
              {#if routeSlug === "reminders" && field.key === "trigger_type"}
                <select
                  class="field"
                  id={`new-${field.key}`}
                  name={field.key}
                  required={field.required}
                  bind:value={reminderTrigger}
                >
                  <option value="">{$t("common.select")}</option>
                  {#each field.options ?? [] as option (option.value)}
                    <option value={option.value}
                      >{featureCopy($locale, option.label)}</option
                    >
                  {/each}
                </select>
              {:else}
                <select
                  class="field"
                  id={`new-${field.key}`}
                  name={field.key}
                  required={field.required}
                >
                  <option value="">{$t("common.select")}</option>
                  {#if field.source === "motorcycles"}
                    {#each motorcycles as motorcycle (motorcycle.id)}
                      <option value={motorcycle.id}>
                        {motorcycle.name} · {motorcycle.brand}
                        {motorcycle.model}
                      </option>
                    {/each}
                  {:else}
                    {#each field.options ?? [] as option (option.value)}
                      <option value={option.value}
                        >{featureCopy($locale, option.label)}</option
                      >
                    {/each}
                  {/if}
                </select>
              {/if}
            {:else}
              <input
                class="field"
                id={`new-${field.key}`}
                name={field.key}
                type={inputType(field)}
                inputmode={inputMode(field)}
                autocomplete={isDecimalField(field) ? "off" : undefined}
                placeholder={decimalPlaceholder(field)}
                min={isIntegerField(field) ? 0 : undefined}
                required={field.required}
                aria-describedby={field.help
                  ? `new-${field.key}-help`
                  : undefined}
              />
            {/if}

            {#if field.help}
              <p class="field-help" id={`new-${field.key}-help`}>
                {featureCopy($locale, field.help)}
              </p>
            {/if}
          </div>
        {/if}
      {/each}

      <div class="sheet-actions">
        <button
          type="button"
          class="button-secondary"
          on:click={() => createSheet?.close()}
        >
          {$t("authenticatedUx.close") || "Fechar"}
        </button>
        <button class="button-primary" type="submit" disabled={formBusy}>
          {$t("common.save")}
        </button>
      </div>
    </form>
  </RecordSheet>

  <RecordSheet
    bind:this={editSheet}
    title={$t("feature.editRecord")}
    closeLabel={$t("authenticatedUx.close") || "Fechar"}
  >
    {#if selectedRow}
      {#key selectedRow.id ?? JSON.stringify(selectedRow)}
        <form
          class="grid gap-4"
          method="POST"
          action="?/record"
          enctype="multipart/form-data"
          use:enhance={enhanceUpdate}
        >
          <input type="hidden" name="_intent" value="update" />
          <input type="hidden" name="id" value={String(selectedRow.id ?? "")} />

          {#if errorStatus}
            <p class={alertClass} role="alert">
              {errorStatus}
            </p>
          {/if}

          {#each feature.fields as field (field.key)}
            {#if isFieldVisible(field.key, editReminderTrigger)}
              <div class="field-group">
                <label class="field-label" for={`edit-${field.key}`}>
                  {featureCopy($locale, field.label)}
                  {#if field.required}<span
                      class="text-[var(--muted)]"
                      aria-hidden="true">*</span
                    >{/if}
                </label>
                {#if field.kind === "textarea"}
                  <textarea
                    class="field min-h-20"
                    id={`edit-${field.key}`}
                    name={field.key}
                    >{String(selectedRow[field.key] ?? "")}</textarea
                  >
                {:else if field.kind === "boolean"}
                  <label class="switch">
                    <input
                      type="checkbox"
                      id={`edit-${field.key}`}
                      name={field.key}
                      value="true"
                      checked={selectedRow[field.key] === true}
                    />
                    <span class="switch-track" aria-hidden="true"></span>
                    <span class="text-sm text-[var(--muted)]"
                      >{$t("common.enabled")}</span
                    >
                  </label>
                {:else if field.kind === "file"}
                  <input
                    class="field"
                    id={`edit-${field.key}`}
                    name={field.key}
                    type="file"
                    accept={routeSlug === "documents"
                      ? "application/pdf,image/avif,image/gif,image/jpeg,image/png,image/webp"
                      : undefined}
                  />
                {:else if field.kind === "select"}
                  {#if routeSlug === "reminders" && field.key === "trigger_type"}
                    <select
                      class="field"
                      id={`edit-${field.key}`}
                      name={field.key}
                      required={field.required}
                      bind:value={editReminderTrigger}
                    >
                      <option value="">{$t("common.select")}</option>
                      {#each field.options ?? [] as option (option.value)}
                        <option value={option.value}
                          >{featureCopy($locale, option.label)}</option
                        >
                      {/each}
                    </select>
                  {:else}
                    <select
                      class="field"
                      id={`edit-${field.key}`}
                      name={field.key}
                      value={String(selectedRow[field.key] ?? "")}
                      required={field.required}
                    >
                      <option value="">{$t("common.select")}</option>
                      {#if field.source === "motorcycles"}
                        {#each motorcycles as motorcycle (motorcycle.id)}
                          <option value={motorcycle.id}>
                            {motorcycle.name} · {motorcycle.brand}
                            {motorcycle.model}
                          </option>
                        {/each}
                      {:else}
                        {#each field.options ?? [] as option (option.value)}
                          <option value={option.value}
                            >{featureCopy($locale, option.label)}</option
                          >
                        {/each}
                      {/if}
                    </select>
                  {/if}
                {:else}
                  <input
                    class="field"
                    id={`edit-${field.key}`}
                    name={field.key}
                    value={editValue(field, selectedRow[field.key])}
                    type={inputType(field)}
                    inputmode={inputMode(field)}
                    autocomplete={isDecimalField(field) ? "off" : undefined}
                    placeholder={decimalPlaceholder(field)}
                    min={isIntegerField(field) ? 0 : undefined}
                    required={field.required}
                    aria-describedby={field.help
                      ? `edit-${field.key}-help`
                      : undefined}
                  />
                {/if}
                {#if field.help}
                  <p class="field-help" id={`edit-${field.key}-help`}>
                    {featureCopy($locale, field.help)}
                  </p>
                {/if}
              </div>
            {/if}
          {/each}

          <div class="sheet-actions">
            <button
              type="button"
              class="button-secondary"
              on:click={() => editSheet?.close()}
            >
              {$t("authenticatedUx.close") || "Fechar"}
            </button>
            <button class="button-primary" type="submit" disabled={formBusy}>
              {$t("common.saveChanges")}
            </button>
          </div>
        </form>
      {/key}
    {/if}
  </RecordSheet>
</section>

<style>
  .row-hover {
    transition: background 0.15s ease;
  }

  .row-hover:hover {
    background: var(--accent-wash);
  }

  /* At phone/tablet widths, a 760px table hides the action column behind an
     invisible horizontal canvas. Keep the semantic table, but let each row
     become a labelled card until the wide desktop layout has room for every
     column. Below 640px the global .data-table rules take the same shape. */
  @media (max-width: 1279px) {
    .feature-table-scroll {
      overflow-x: visible;
    }

    .feature-table {
      min-width: 0;
      border-collapse: separate;
      border-spacing: 0 0.75rem;
    }

    .feature-table thead {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .feature-table tbody {
      display: grid;
      gap: 0.75rem;
    }

    .feature-table tbody tr {
      display: block;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--panel);
    }

    .feature-table tbody tr td {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      min-width: 0;
      border-bottom: 1px solid var(--line);
      padding: 0.75rem 1rem;
      text-align: left;
    }

    .feature-table tbody tr td::before {
      flex: 0 0 36%;
      min-width: 0;
      color: var(--muted);
      content: attr(data-label);
      font-family: var(--font-sans);
      font-stretch: 100%;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      line-height: 1.3;
    }

    .feature-table tbody tr td > * {
      min-width: 0;
      max-width: 64%;
      overflow-wrap: anywhere;
    }

    .feature-table tbody tr td:last-child {
      border-bottom: 0;
    }

    .feature-table tbody tr td.feature-actions {
      display: block;
    }

    .feature-table tbody tr td.feature-actions::before {
      display: block;
      margin-bottom: 0.65rem;
    }

    .feature-table tbody tr td.feature-actions > div {
      max-width: none;
    }
  }

  @media (min-width: 1280px) {
    .feature-table {
      min-width: 760px;
    }
  }
</style>
