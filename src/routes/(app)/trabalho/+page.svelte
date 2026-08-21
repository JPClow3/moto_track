<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
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
          ? $t("common.actionSuccess")
          : String(
              "data" in result && result.data?.message
                ? result.data.message
                : $t("error.serverBody"),
            );
      await update();
    };
  };
</script>

<svelte:head><title>{$t("trabalho.pageTitle")} · Moto Track</title></svelte:head
>

<FeaturePage
  feature={localizedFeature}
  rows={data.rows}
  motorcycles={data.motorcycles}
  errorMessage={!form?.ok
    ? form?.message || data.errorMessage
    : data.errorMessage}
/>
<section class="mt-6 grid gap-4 lg:grid-cols-2" aria-busy={formBusy}>
  {#if statusMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger lg:col-span-2"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm lg:col-span-2"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
    </p>
  {/if}
  <form
    class="panel grid gap-2 p-5"
    method="POST"
    action="?/saveCosts"
    use:enhance={enhanceWithStatus}
  >
    <h2 class="display text-xl">{$t("trabalho.costsTitle")}</h2>
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
      Reserva de manutenção por km
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
      Depreciação por km
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
    <label class="field-label" for="work-fixed-cost"> Custo fixo diário </label>
    <input
      class="field"
      id="work-fixed-cost"
      name="fixed_daily_cost"
      type="number"
      step=".01"
      min="0"
    />
    <p class="field-help">{$t("trabalho.fixedCostHelp")}</p>
    <button
      class="button-secondary justify-self-start"
      type="submit"
      disabled={formBusy}
    >
      Salvar custos
    </button>
  </form>
  <div class="panel p-5">
    <h2 class="display text-xl">{$t("trabalho.profitabilityTitle")}</h2>
    {#each data.summaries as s}
      <p class="mt-2 text-sm">
        {s.work_date} · {$t("trabalho.profitLabel", {
          value: brl(s.profitability.profitCents),
        })}
      </p>
    {:else}
      <p class="mt-2 text-sm text-[var(--muted)]">
        {$t("trabalho.noSessions")}
      </p>
    {/each}
  </div>
</section>
