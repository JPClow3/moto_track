<script lang="ts">
  import { t, format } from "$lib/i18n/store";

  export let items: Array<{
    maintenance_type: string;
    interval_km: number | null;
  }> = [];
  export let isExactSchedule = false;
  export let showHeading = true;

  // One answer covers every item (`history_all`); a per-item answer
  // (`history_<type>`) only overrides it when the rider opens the detail.
  // "Não sei" is the honest default and shows as "a confirmar", not a warning.
  let overall = "unknown";
</script>

<div class="grid gap-3">
  <div>
    {#if showHeading}
      <h2 class="display text-2xl">{$t("history.title")}</h2>
    {/if}
    <p class="mt-1 text-sm text-[var(--muted)]">
      {$t("history.hint")}
      {isExactSchedule ? $t("history.hintExact") : $t("history.hintLine")}
    </p>
  </div>

  <fieldset class="grid gap-2">
    <legend class="mb-2 text-base font-semibold">
      {$t("history.overallQuestion")}
    </legend>
    {#each [{ value: "confirmed_done", label: $t("history.overallYes") }, { value: "not_done", label: $t("history.overallNo") }, { value: "unknown", label: $t("history.overallUnknown") }] as option (option.value)}
      <label
        class="flex min-h-11 items-center gap-3 rounded border px-3 text-sm {overall ===
        option.value
          ? 'border-[var(--fg)] font-semibold'
          : 'border-[var(--line)]'}"
      >
        <input
          type="radio"
          name="history_all"
          value={option.value}
          bind:group={overall}
        />
        {option.label}
      </label>
    {/each}
  </fieldset>

  {#if items.length}
    <details class="rounded border border-[var(--line)]">
      <summary
        class="focus-ring flex min-h-11 cursor-pointer items-center rounded px-3 text-sm font-semibold"
      >
        {$t("history.adjustEach")}
      </summary>
      <ul class="grid gap-2 border-t border-[var(--line)] p-3">
        {#each items as item (item.maintenance_type)}
          {@const id = `history-${item.maintenance_type}`}
          <li
            class="grid gap-1 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center"
          >
            <label class="text-sm" for={id}>
              <span class="font-semibold">{item.maintenance_type}</span>
              <span class="block text-xs text-[var(--muted)]">
                {#if item.interval_km}
                  {isExactSchedule
                    ? $t("history.manualInterval")
                    : $t("history.starterInterval")}
                  {$format.distance(item.interval_km)}
                {:else}
                  {$t("history.checkManual")}
                {/if}
              </span>
            </label>
            <select
              class="field"
              {id}
              name={`history_${item.maintenance_type}`}
            >
              <option value="">{$t("history.sameAsAbove")}</option>
              <option value="confirmed_done"
                >{$t("history.confirmedDone")}</option
              >
              <option value="not_done">{$t("history.notDone")}</option>
              <option value="unknown">{$t("history.unknown")}</option>
            </select>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</div>
