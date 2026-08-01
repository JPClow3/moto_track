<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  export let data;
  export let form;

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
          ? "Custos salvos."
          : String(
              "data" in result && result.data?.message
                ? result.data.message
                : "Não foi possível salvar os custos.",
            );
      await update();
    };
  };
</script>

<FeaturePage
  {...data}
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
    class="panel grid gap-2 p-4"
    method="POST"
    action="?/saveCosts"
    use:enhance={enhanceWithStatus}
  >
    <h2 class="font-bold">Custos profissionais</h2>
    <label class="field-label" for="work-cost-motorcycle">Moto</label>
    <select class="field" id="work-cost-motorcycle" name="motorcycle_id"
      >{#each data.motorcycles as m}<option value={m.id}>{m.name}</option
        >{/each}</select
    ><label class="field-label" for="work-maintenance-reserve"
      >Reserva de manutenção por km</label
    ><input
      class="field"
      id="work-maintenance-reserve"
      name="maintenance_reserve"
      type="number"
      step=".01"
      placeholder="Reserva de manutenção por km"
    /><label class="field-label" for="work-depreciation"
      >Depreciação por km</label
    ><input
      class="field"
      id="work-depreciation"
      name="depreciation"
      type="number"
      step=".01"
      placeholder="Depreciação por km"
    /><label class="field-label" for="work-fixed-cost">Custo fixo diário</label
    ><input
      class="field"
      id="work-fixed-cost"
      name="fixed_daily_cost"
      type="number"
      step=".01"
      placeholder="Custo fixo diário"
    /><button class="button-secondary" type="submit" disabled={formBusy}
      >Salvar custos</button
    >
  </form>
  <div class="panel p-4">
    <h2 class="font-bold">Rentabilidade das sessões</h2>
    {#each data.summaries as s}<p class="mt-2 text-sm">
        {s.work_date}: lucro R$ {(s.profitability.profitCents / 100).toFixed(2)}
      </p>{/each}
  </div>
</section>
