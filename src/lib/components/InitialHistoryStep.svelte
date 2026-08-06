<script lang="ts">
  import { t, format } from "$lib/i18n/store";

  export let items: Array<{
    maintenance_type: string;
    interval_km: number | null;
  }> = [];
  export let isExactSchedule = false;
  export let showHeading = true;
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
  {#each items as item (item.maintenance_type)}
    <fieldset class="rounded border border-[var(--line)] p-3">
      <legend class="px-1 text-sm font-semibold">{item.maintenance_type}</legend
      >
      <p class="mb-2 text-xs text-[var(--muted)]">
        {#if item.interval_km}
          {isExactSchedule
            ? $t("history.manualInterval")
            : $t("history.starterInterval")}: {$format.distance(
            item.interval_km,
          )}
        {:else}
          {$t("history.checkManual")}
        {/if}
      </p>
      <div class="grid gap-2 text-sm sm:grid-cols-3">
        <label class="flex min-h-11 items-center gap-2 rounded px-2">
          <input
            type="radio"
            name={`history_${item.maintenance_type}`}
            value="confirmed_done"
          />
          {$t("history.confirmedDone")}
        </label>
        <label class="flex min-h-11 items-center gap-2 rounded px-2">
          <input
            type="radio"
            name={`history_${item.maintenance_type}`}
            value="not_done"
          />
          {$t("history.notDone")}
        </label>
        <label class="flex min-h-11 items-center gap-2 rounded px-2">
          <input
            type="radio"
            name={`history_${item.maintenance_type}`}
            value="unknown"
            checked
          />
          {$t("history.unknown")}
        </label>
      </div>
    </fieldset>
  {/each}
</div>
