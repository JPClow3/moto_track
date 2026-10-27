<svelte:options runes={false} />

<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import SignalStrip, {
    type Signal,
  } from "$lib/components/app/SignalStrip.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatDate, formatMoney } from "$lib/i18n";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);

  $: hasMotorcycles = data.motorcycles.length > 0;
  // Nav says "Trabalho", the route is /trabalho — the generic config used to
  // render the English "Work" title on top of all that.
  $: localizedFeature = {
    ...data.feature,
    slug: $t("nav.work"),
    title: $t("trabalho.pageTitle"),
    subtitle: $t("trabalho.pageSubtitle"),
  };

  $: recentSummaries = (data.summaries ?? []).slice(0, 3);
  $: profitSignals = recentSummaries.map(
    (s: {
      work_date: string;
      profitability: { profitCents: number };
    }): Signal => ({
      label: formatDate($locale, s.work_date),
      value: brl(s.profitability.profitCents),
    }),
  );

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let costsSheet: RecordSheet;

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      statusRole = result.type === "success" ? "status" : "alert";
      statusMessage =
        result.type === "success"
          ? $t("common.actionSuccess")
          : String(
              "data" in result && result.data?.message
                ? result.data.message
                : $t("error.serverBody"),
            );
      if (result.type === "success") {
        costsSheet?.close();
      }
      await update();
    };
  };
</script>

<svelte:head><title>{$t("trabalho.pageTitle")} · Moto Track</title></svelte:head
>

<section aria-busy={formBusy}>
  <FeaturePage
    routeSlug="trabalho"
    feature={localizedFeature}
    rows={data.rows}
    motorcycles={data.motorcycles}
    errorMessage={!form?.ok
      ? form?.message || data.errorMessage
      : data.errorMessage}
  >
    <svelte:fragment slot="overflow">
      <button
        type="button"
        class="focus-ring flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--line)]"
        on:click={() => costsSheet?.open()}
      >
        {$t("trabalho.costsTitle")}
      </button>
    </svelte:fragment>

    <svelte:fragment slot="afterHeader">
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
      <SignalStrip
        title={$t("trabalho.profitabilityTitle")}
        signals={profitSignals}
      />
      {#if recentSummaries.length > 0}
        <ul class="mt-2 grid gap-1 text-sm text-[var(--muted)]">
          {#each recentSummaries as s, index (index)}
            <li>
              {formatDate($locale, s.work_date)} · {$t("trabalho.profitLabel", {
                value: brl(s.profitability.profitCents),
              })}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-2 text-sm text-[var(--muted)]">
          {$t("trabalho.noSessions")}
        </p>
      {/if}
    </svelte:fragment>
  </FeaturePage>

  <RecordSheet
    bind:this={costsSheet}
    title={$t("trabalho.costsTitle")}
    closeLabel={$t("authenticatedUx.close") || "Fechar"}
  >
    <form
      class="grid gap-3"
      method="POST"
      action="?/saveCosts"
      use:enhance={enhanceWithStatus}
    >
      <label class="field-label" for="work-cost-motorcycle">
        {$t("maintenance.bikeFallback")}
      </label>
      <select
        class="field"
        id="work-cost-motorcycle"
        name="motorcycle_id"
        disabled={!hasMotorcycles}
      >
        {#each data.motorcycles as m (m.id)}
          <option value={m.id}>{m.name}</option>
        {/each}
      </select>
      <label class="field-label" for="work-maintenance-reserve">
        {$t("trabalho.maintenanceReserveLabel")}
      </label>
      <input
        class="field"
        id="work-maintenance-reserve"
        name="maintenance_reserve"
        type="number"
        step=".01"
        min="0"
      />
      <p class="field-help">{$t("trabalho.reserveHelp")}</p>
      <label class="field-label" for="work-depreciation">
        {$t("trabalho.depreciationLabel")}
      </label>
      <input
        class="field"
        id="work-depreciation"
        name="depreciation"
        type="number"
        step=".01"
        min="0"
      />
      <p class="field-help">{$t("trabalho.depreciationHelp")}</p>
      <label class="field-label" for="work-fixed-cost">
        {$t("trabalho.fixedCostLabel")}
      </label>
      <input
        class="field"
        id="work-fixed-cost"
        name="fixed_daily_cost"
        type="number"
        step=".01"
        min="0"
      />
      <p class="field-help">{$t("trabalho.fixedCostHelp")}</p>
      <div class="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          class="button-secondary"
          on:click={() => costsSheet?.close()}
        >
          {$t("authenticatedUx.close") || "Fechar"}
        </button>
        <button
          class="button-accent min-h-11"
          type="submit"
          disabled={formBusy}
        >
          {$t("trabalho.saveCosts")}
        </button>
      </div>
    </form>
  </RecordSheet>
</section>
