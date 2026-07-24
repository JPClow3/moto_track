<script lang="ts">
  import { enhance } from "$app/forms";
  import { Download, Plus } from "lucide-svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import type { FeatureConfig } from "$server/domain/features";
  import { t, locale } from "$lib/i18n/store";
  import { formatMoney, formatPreciseMoney } from "$lib/i18n";
  import { privateFileUrl } from "$lib/utils/private-file-url";

  export let feature: FeatureConfig;
  export let rows: Array<Record<string, unknown>> = [];
  export let motorcycles: Array<{
    id: string;
    name: string;
    brand: string;
    model: string;
  }> = [];
  export let errorMessage = "";

  // The table used to print raw database column names ("fuel_type",
  // "odometer_km") straight into the header. The feature config already carries
  // a human label for every field, so use it and fall back to a de-underscored
  // key.
  //
  // Plain functions rather than `$:` assignments: switching locale is a full
  // form POST + redirect, so the component remounts and there is nothing to
  // react to. (Reactive function definitions also trip svelte/no-reactive-functions.)
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

  const inputType = (kind: string) =>
    kind === "date"
      ? "date"
      : kind === "number" || kind === "money"
        ? "number"
        : "text";
</script>

<section class="grid gap-6">
  <header
    class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
  >
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>
        {feature.slug}
      </p>
      <h1 class="display mt-3 text-4xl">{feature.title}</h1>
      <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">
        {feature.subtitle}
      </p>
    </div>
    <a class="button-secondary shrink-0" href={`/${feature.slug}/export.csv`}>
      <Download size={14} aria-hidden="true" />
      {$t("common.exportCsv")}
    </a>
  </header>

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

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
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
                >{$t("common.status")}</th
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
                  <td class="px-4 py-3">
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
                <td class="px-4 py-3 text-xs text-[var(--muted)]"
                  >{valueFor(row, "updated_at")}</td
                >
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    {#if feature.slug === "reminders"}
                      <form method="POST" action="?/snoozeDays" use:enhance>
                        <input
                          type="hidden"
                          name="id"
                          value={String(row.id ?? "")}
                        />
                        <input type="hidden" name="days" value="7" />
                        <button
                          class="button-secondary min-h-8 px-3 py-1 text-xs"
                          type="submit"
                        >
                          {$t("reminders.snoozeDays")}
                        </button>
                      </form>
                      <form method="POST" action="?/snoozeKm" use:enhance>
                        <input
                          type="hidden"
                          name="id"
                          value={String(row.id ?? "")}
                        />
                        <input type="hidden" name="km" value="500" />
                        <button
                          class="button-secondary min-h-8 px-3 py-1 text-xs"
                          type="submit"
                        >
                          {$t("reminders.snoozeKm")}
                        </button>
                      </form>
                      <form method="POST" action="?/complete" use:enhance>
                        <input
                          type="hidden"
                          name="id"
                          value={String(row.id ?? "")}
                        />
                        <button
                          class="button-primary min-h-8 px-3 py-1 text-xs"
                          type="submit"
                        >
                          {$t("reminders.complete")}
                        </button>
                      </form>
                    {/if}
                    <!-- Deleting was a single unguarded click with no undo.
                         enhance awaits this callback before it fires the
                         request, so the dialog can gate the submit. -->
                    <form
                      method="POST"
                      use:enhance={async ({ cancel }) => {
                        const ok = await confirmDialog.ask(
                          $t("feature.confirmDelete"),
                        );
                        if (!ok) cancel();
                      }}
                    >
                      <input type="hidden" name="_intent" value="delete" />
                      <input
                        type="hidden"
                        name="id"
                        value={String(row.id ?? "")}
                      />
                      <button
                        class="button-danger min-h-8 px-3 py-1 text-xs"
                        type="submit"
                      >
                        {$t("common.delete")}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
              <tr class="edit-row border-b border-[var(--line)]">
                <td class="px-4 py-3" colspan={feature.listColumns.length + 2}>
                  <details>
                    <summary
                      class="focus-ring cursor-pointer rounded text-sm font-semibold"
                    >
                      {$t("feature.editRecord")}
                    </summary>
                    <form
                      class="mt-3 grid gap-4 md:grid-cols-2"
                      method="POST"
                      enctype="multipart/form-data"
                      use:enhance
                    >
                      <input type="hidden" name="_intent" value="update" />
                      <input
                        type="hidden"
                        name="id"
                        value={String(row.id ?? "")}
                      />
                      {#each feature.fields as field (field.key)}
                        <div class="field-group">
                          <label
                            class="field-label"
                            for={`edit-${row.id}-${field.key}`}
                          >
                            {field.label}
                          </label>
                          {#if field.kind === "textarea"}
                            <textarea
                              class="field min-h-20"
                              id={`edit-${row.id}-${field.key}`}
                              name={field.key}
                              >{String(row[field.key] ?? "")}</textarea
                            >
                          {:else if field.kind === "boolean"}
                            <label class="switch">
                              <input
                                type="checkbox"
                                id={`edit-${row.id}-${field.key}`}
                                name={field.key}
                                value="true"
                                checked={row[field.key] === true}
                              />
                              <span class="switch-track" aria-hidden="true"
                              ></span>
                              <span class="text-sm text-[var(--muted)]"
                                >{$t("common.enabled")}</span
                              >
                            </label>
                          {:else if field.kind === "file"}
                            <input
                              class="field"
                              id={`edit-${row.id}-${field.key}`}
                              name={field.key}
                              type="file"
                            />
                          {:else if field.kind === "select"}
                            <select
                              class="field"
                              id={`edit-${row.id}-${field.key}`}
                              name={field.key}
                              value={String(row[field.key] ?? "")}
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
                                    >{option.label}</option
                                  >
                                {/each}
                              {/if}
                            </select>
                          {:else}
                            <input
                              class="field"
                              id={`edit-${row.id}-${field.key}`}
                              name={field.key}
                              value={String(row[field.key] ?? "")}
                              type={inputType(field.kind)}
                              step={field.kind === "money" ? "0.01" : "any"}
                              required={field.required}
                            />
                          {/if}
                        </div>
                      {/each}
                      <div class="flex items-end">
                        <button class="button-primary" type="submit"
                          >{$t("common.saveChanges")}</button
                        >
                      </div>
                    </form>
                  </details>
                </td>
              </tr>
            {:else}
              <tr>
                <td
                  class="px-4 py-16 text-center"
                  colspan={feature.listColumns.length + 2}
                >
                  <p class="display text-2xl">{$t("feature.noRecords")}</p>
                  <p class="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
                    {$t("feature.noRecordsHint")}
                  </p>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <form
      class="panel relative grid h-fit gap-4 overflow-hidden p-5"
      method="POST"
      enctype="multipart/form-data"
      use:enhance
    >
      <div class="corner-slashes" aria-hidden="true"></div>
      <input type="hidden" name="_intent" value="create" />
      <div class="relative">
        <h2 class="display flex items-center gap-2 text-2xl">
          <Plus size={18} class="text-[var(--accent)]" aria-hidden="true" />
          {$t("feature.newRecord")}
        </h2>
        <p class="mt-1.5 text-sm text-[var(--muted)]">
          {$t("feature.newRecordHint")}
        </p>
      </div>

      {#each feature.fields as field (field.key)}
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
            <p class="field-help" id={`new-${field.key}-help`}>{field.help}</p>
          {/if}
        </div>
      {/each}

      <button class="button-accent mt-1" type="submit"
        >{$t("common.save")}</button
      >
    </form>
  </div>
</section>

<style>
  /* A tint derived from --fg, so it lightens the row in dark mode instead of
     painting black-on-black like the old bg-black/[0.015] did. */
  .edit-row {
    background: color-mix(in srgb, var(--fg) 3%, transparent);
  }

  .row-hover {
    transition: background 0.15s ease;
  }

  .row-hover:hover {
    background: color-mix(in srgb, var(--accent) 4%, transparent);
  }

  /* The logo's speed-mark, reused as a corner motif — same treatment as the
     Pro card on /precos and the health panel on the dashboard. */
  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    pointer-events: none;
    opacity: 0.15;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }
</style>
