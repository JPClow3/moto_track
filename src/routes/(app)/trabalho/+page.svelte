<script lang="ts">
  import { appCopy } from "$lib/i18n/app-copy";
  import FeaturePage from "$components/FeaturePage.svelte";
  import { showToast } from "$components/ui/toast";
  import BriefcaseBusiness from "lucide-svelte/icons/briefcase-business";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatDate, formatMoney } from "$lib/i18n";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: hasSessions = data.rows.length > 0;
  // Nav says "Trabalho", the route is /trabalho — the generic config used to
  // render the English "Work" title on top of all that.
  $: localizedFeature = {
    ...data.feature,
    slug: $t("nav.work"),
    title: $t("trabalho.pageTitle"),
    subtitle: $t("trabalho.pageSubtitle"),
  };

  let formBusy = false;
  let errorStatus = "";

  const enhanceCosts: SubmitFunction = () => {
    formBusy = true;
    errorStatus = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") {
        showToast($t("recordsUx.costsSaved"));
      } else {
        errorStatus = String(
          "data" in result && result.data?.message
            ? result.data.message
            : $t("error.serverBody"),
        );
      }
      await update({ reset: false });
    };
  };
</script>

<svelte:head><title>{$t("trabalho.pageTitle")} · Moto Track</title></svelte:head
>

<FeaturePage
  routeSlug="trabalho"
  feature={localizedFeature}
  rows={data.rows}
  motorcycles={data.motorcycles}
  errorMessage={!form?.ok
    ? form?.message || data.errorMessage
    : data.errorMessage}
  emptyIcon={BriefcaseBusiness}
  emptyTitle={$t("recordsUx.workEmpty")}
/>
{#if hasMotorcycles}
  <section class="mt-6 grid gap-4 lg:grid-cols-2" aria-busy={formBusy}>
    {#if errorStatus}
      <p
        class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)] lg:col-span-2"
        role="alert"
        aria-live="assertive"
      >
        {errorStatus}
      </p>
    {/if}
    <form
      class="panel grid content-start gap-2 p-5"
      method="POST"
      action="?/saveCosts"
      use:enhance={enhanceCosts}
    >
      <h2 class="display text-xl">{$t("trabalho.costsTitle")}</h2>
      <label class="field-label" for="work-cost-motorcycle">
        {$t("maintenance.bikeFallback")}
      </label>
      <select class="field" id="work-cost-motorcycle" name="motorcycle_id">
        {#each data.motorcycles as m (m.id)}
          <option value={m.id}>{m.name}</option>
        {/each}
      </select>
      <label class="field-label" for="work-maintenance-reserve">
        {appCopy($locale, "Reserva de manutenção por km")}
      </label>
      <input
        class="field"
        id="work-maintenance-reserve"
        name="maintenance_reserve"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder={$locale === "en" ? "0.00" : "0,00"}
        aria-describedby="work-maintenance-reserve-help"
      />
      <p class="field-help" id="work-maintenance-reserve-help">
        {$t("trabalho.reserveHelp")}
      </p>
      <label class="field-label" for="work-depreciation">
        {appCopy($locale, "Depreciação por km")}
      </label>
      <input
        class="field"
        id="work-depreciation"
        name="depreciation"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder={$locale === "en" ? "0.00" : "0,00"}
        aria-describedby="work-depreciation-help"
      />
      <p class="field-help" id="work-depreciation-help">
        {$t("trabalho.depreciationHelp")}
      </p>
      <label class="field-label" for="work-fixed-cost">
        {appCopy($locale, "Custo fixo diário")}
      </label>
      <input
        class="field"
        id="work-fixed-cost"
        name="fixed_daily_cost"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder={$locale === "en" ? "0.00" : "0,00"}
        aria-describedby="work-fixed-cost-help"
      />
      <p class="field-help" id="work-fixed-cost-help">
        {$t("trabalho.fixedCostHelp")}
      </p>
      <button
        class="button-primary justify-self-start"
        type="submit"
        disabled={formBusy}
      >
        {appCopy($locale, "Salvar custos")}
      </button>
    </form>
    {#if hasSessions}
      <div class="panel overflow-hidden">
        <h2 class="display p-5 pb-3 text-xl">
          {$t("trabalho.profitabilityTitle")}
        </h2>
        <div class="data-table">
          <table class="w-full text-left text-sm">
            <thead
              class="border-y border-[var(--line)] bg-[var(--accent-wash)] text-[var(--muted)]"
            >
              <tr>
                <th class="label-tech px-5 py-2" scope="col"
                  >{$t("recordsUx.sessionDate")}</th
                >
                <th class="label-tech px-5 py-2 text-right" scope="col"
                  >{$t("recordsUx.sessionProfit")}</th
                >
              </tr>
            </thead>
            <tbody>
              {#each data.summaries as s, index (index)}
                <tr class="border-b border-[var(--line)] last:border-b-0">
                  <td class="px-5 py-2" data-label={$t("recordsUx.sessionDate")}
                    >{formatDate($locale, s.work_date)}</td
                  >
                  <td
                    class="numeric px-5 py-2 text-right font-semibold"
                    data-label={$t("recordsUx.sessionProfit")}
                    >{brl(s.profitability.profitCents)}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </section>
{/if}
