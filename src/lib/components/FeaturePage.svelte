<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import Download from "lucide-svelte/icons/download";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { createEventDispatcher } from "svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import PageAction from "$lib/components/app/PageAction.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import PageOverflowMenu from "$lib/components/app/PageOverflowMenu.svelte";
  import ActionMenu, {
    type ActionChoice,
  } from "$lib/components/app/ActionMenu.svelte";
  import type { FeatureConfig } from "$server/domain/features";
  import { t, locale, format } from "$lib/i18n/store";
  import { formatMoney, formatPreciseMoney } from "$lib/i18n";
  import { privateFileUrl } from "$lib/utils/private-file-url";

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

  const dispatch = createEventDispatcher<{
    actionSelect: string;
  }>();

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";

  let createSheet: RecordSheet;
  let editSheet: RecordSheet;
  let actionMenu: ActionMenu;
  let selectedRow: Record<string, unknown> | null = null;
  let editReminderTrigger = "by_km";

  export function openCreate() {
    createSheet?.open();
  }

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
      feature.fields.find((field) => field.key === column)?.label ??
      column.replaceAll("_", " ")
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
    if (key.endsWith("_cents") && typeof value === "number") {
      return formatMoney($locale, value);
    }
    if (key.endsWith("_millicents") && typeof value === "number") {
      return formatPreciseMoney($locale, value);
    }
    return String(value);
  }

  // One dialog for the whole table rather than one per row.
  let confirmDialog: ConfirmDialog;

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        statusRole = "status";
        statusMessage = $t("feature.operationComplete");
      } else if (result.type === "failure") {
        statusRole = "alert";
        statusMessage = String(
          result.data?.message ?? $t("feature.operationFailed"),
        );
      } else if (result.type === "error") {
        statusRole = "alert";
        statusMessage = $t("feature.operationFailed");
      }
      await update();
    };
  };

  const enhanceCreate: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        statusRole = "status";
        statusMessage = $t("feature.operationComplete");
        await update();
        createSheet?.close();
      } else {
        if (result.type === "failure") {
          statusRole = "alert";
          statusMessage = String(
            result.data?.message ?? $t("feature.operationFailed"),
          );
        } else if (result.type === "error") {
          statusRole = "alert";
          statusMessage = $t("feature.operationFailed");
        }
        await update();
      }
    };
  };

  const enhanceUpdate: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        statusRole = "status";
        statusMessage = $t("feature.operationComplete");
        await update();
        editSheet?.close();
      } else {
        if (result.type === "failure") {
          statusRole = "alert";
          statusMessage = String(
            result.data?.message ?? $t("feature.operationFailed"),
          );
        } else if (result.type === "error") {
          statusRole = "alert";
          statusMessage = $t("feature.operationFailed");
        }
        await update();
      }
    };
  };

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask($t("feature.confirmDelete"));
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        statusRole = "status";
        statusMessage = $t("feature.deleteComplete");
      } else if (result.type === "failure") {
        statusRole = "alert";
        statusMessage = String(
          result.data?.message ?? $t("feature.deleteFailed"),
        );
      } else {
        statusRole = "alert";
        statusMessage = $t("feature.deleteFailed");
      }
      await update();
    };
  };

  const inputType = (kind: string) =>
    kind === "date"
      ? "date"
      : kind === "number" || kind === "money"
        ? "number"
        : "text";
</script>

<section class="grid gap-6" aria-busy={formBusy}>
  <PageHeader
    eyebrow={feature.slug}
    title={feature.title}
    description={feature.subtitle}
  >
    <svelte:fragment slot="actions">
      <PageAction
        label={addLabel || $t("feature.newRecord")}
        ariaLabel={addLabel || $t("feature.newRecord")}
        on:click={handleActionClick}
      />
    </svelte:fragment>
    <svelte:fragment slot="overflow">
      <PageOverflowMenu
        label={$t("authenticatedUx.moreActions") || "Mais ações"}
      >
        <a
          class="focus-ring flex items-center gap-2 rounded px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--line)]"
          href={`/${routeSlug}/export.csv`}
        >
          <Download size={14} aria-hidden="true" />
          {$t("common.exportCsv")}
        </a>
      </PageOverflowMenu>
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
         only being a red box someone has to notice. -->
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      role="alert"
    >
      {errorMessage}
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

  <div class="panel overflow-hidden">
    <div
      class="border-[var(--accent)]/20 flex items-center justify-between gap-3 border-b bg-[var(--accent-soft)] px-4 py-2.5"
    >
      <span class="label-tech text-[var(--accent)]"
        >{$t(
          rows.length === 1
            ? "feature.recordCountOne"
            : "feature.recordCountOther",
          { count: rows.length },
        )}</span
      >
    </div>
    <div class="feature-table-scroll overflow-x-auto">
      <table class="feature-table w-full text-left text-sm">
        <caption class="sr-only"
          >{$t("feature.recordsCaption", { feature: feature.title })}</caption
        >
        <thead
          class="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] text-[var(--muted)]"
        >
          <tr>
            {#each feature.listColumns as column (column)}
              <th class="label-tech px-4 py-3 text-left" scope="col"
                >{labelForColumn(column)}</th
              >
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
            <tr class="row-hover border-b border-[var(--line)]">
              {#each feature.listColumns as column (column)}
                {@const href = fileHref(row, column)}
                <td class="px-4 py-3" data-label={labelForColumn(column)}>
                  {#if href}
                    <a
                      class="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
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
              {/each}
              <td
                class="px-4 py-3 text-xs text-[var(--muted)]"
                data-label={$t("feature.updatedAt")}
              >
                {#if row.updated_at && typeof row.updated_at === "string"}
                  {$format.date(row.updated_at, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                {:else}
                  {valueFor(row, "updated_at")}
                {/if}
              </td>
              <td
                class="feature-actions px-4 py-3"
                data-label={$t("common.actions")}
              >
                <div class="flex flex-wrap gap-2">
                  {#if feature.slug === "reminders" || routeSlug === "reminders"}
                    <form
                      method="POST"
                      action="?/snoozeDays"
                      use:enhance={enhanceWithStatus}
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
                      use:enhance={enhanceWithStatus}
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
                      use:enhance={enhanceWithStatus}
                    >
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
          {:else}
            <tr>
              <td
                class="px-4 py-16 text-center"
                colspan={feature.listColumns.length + 2}
              >
                <div
                  class="mx-auto max-w-sm rounded border border-dashed border-[var(--line)] p-8"
                >
                  <p class="display text-2xl">{$t("feature.noRecords")}</p>
                  <p class="mt-2 text-sm text-[var(--muted)]">
                    {$t("feature.noRecordsHint")}
                  </p>
                  <button
                    type="button"
                    class="button-primary mt-4"
                    on:click={handleActionClick}
                  >
                    {$t("feature.addFirst")}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

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

      {#if statusMessage && statusRole === "alert"}
        <p
          class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          role="alert"
        >
          {statusMessage}
        </p>
      {/if}

      {#each feature.fields as field (field.key)}
        {#if isFieldVisible(field.key, reminderTrigger)}
          <div class="field-group">
            <label class="field-label" for={`new-${field.key}`}>
              {field.label}
              {#if field.required}<span
                  class="text-[var(--accent)]"
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
                    <option value={option.value}>{option.label}</option>
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
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  {/if}
                </select>
              {/if}
            {:else}
              <input
                class="field"
                id={`new-${field.key}`}
                name={field.key}
                type={inputType(field.kind)}
                step={field.kind === "money" ? "0.01" : "any"}
                required={field.required}
                aria-describedby={field.help
                  ? `new-${field.key}-help`
                  : undefined}
              />
            {/if}

            {#if field.help}
              <p class="field-help" id={`new-${field.key}-help`}>
                {field.help}
              </p>
            {/if}
          </div>
        {/if}
      {/each}

      <div class="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          class="button-secondary"
          on:click={() => createSheet?.close()}
        >
          {$t("authenticatedUx.close") || "Fechar"}
        </button>
        <button class="button-accent" type="submit" disabled={formBusy}>
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

          {#if statusMessage && statusRole === "alert"}
            <p
              class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
              role="alert"
            >
              {statusMessage}
            </p>
          {/if}

          {#each feature.fields as field (field.key)}
            {#if isFieldVisible(field.key, editReminderTrigger)}
              <div class="field-group">
                <label class="field-label" for={`edit-${field.key}`}>
                  {field.label}
                  {#if field.required}<span
                      class="text-[var(--accent)]"
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
                        <option value={option.value}>{option.label}</option>
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
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      {/if}
                    </select>
                  {/if}
                {:else}
                  <input
                    class="field"
                    id={`edit-${field.key}`}
                    name={field.key}
                    value={String(selectedRow[field.key] ?? "")}
                    type={inputType(field.kind)}
                    step={field.kind === "money" ? "0.01" : "any"}
                    required={field.required}
                    aria-describedby={field.help
                      ? `edit-${field.key}-help`
                      : undefined}
                  />
                {/if}
                {#if field.help}
                  <p class="field-help" id={`edit-${field.key}-help`}>
                    {field.help}
                  </p>
                {/if}
              </div>
            {/if}
          {/each}

          <div class="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              class="button-secondary"
              on:click={() => editSheet?.close()}
            >
              {$t("authenticatedUx.close") || "Fechar"}
            </button>
            <button class="button-accent" type="submit" disabled={formBusy}>
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
    background: color-mix(in srgb, var(--accent) 4%, transparent);
  }

  /* At phone/tablet widths, a 760px table hides the action column behind an
     invisible horizontal canvas. Keep the semantic table, but let each row
     become a labelled card until the wide desktop layout has room for every
     column. */
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
    }

    .feature-table tbody tr td::before {
      flex: 0 0 36%;
      min-width: 0;
      color: var(--muted);
      content: attr(data-label);
      font-family: "Barlow Condensed", Barlow, ui-sans-serif, sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      line-height: 1.2;
      text-transform: uppercase;
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
