<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown };
  }) => {
    statusRole = result.type === "success" ? "status" : "alert";
    statusMessage =
      result.type === "success"
        ? "Operação concluída."
        : String(result.data?.message ?? "Não foi possível concluir.");
  };

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask(
      "Excluir este item? Esta ação não pode ser desfeita.",
    );
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
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
<section class="mt-6 grid gap-6" aria-busy={formBusy}>
  <ConfirmDialog bind:this={confirmDialog} confirmLabel="Excluir" />
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
  <div class="grid gap-4 lg:grid-cols-2">
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/saveProduct"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="font-bold">Catálogo de pneus</h2>
      <label class="field-label" for="tire-manufacturer">Fabricante</label>
      <input
        class="field"
        id="tire-manufacturer"
        name="manufacturer"
        placeholder="Fabricante"
        required
      /><label class="field-label" for="tire-model">Modelo</label><input
        class="field"
        id="tire-model"
        name="model_name"
        placeholder="Modelo"
        required
      /><label class="field-label" for="tire-type">Tipo</label><input
        class="field"
        id="tire-type"
        name="tire_type"
        placeholder="Tipo"
      /><label class="field-label" for="tire-price">Preço</label><input
        class="field"
        id="tire-price"
        name="price"
        type="number"
        step=".01"
        placeholder="Preço"
      /><button class="button-secondary" type="submit" disabled={formBusy}
        >Salvar produto</button
      >
    </form>
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/savePressure"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="font-bold">Pressão</h2>
      <label class="field-label" for="tire-pressure-motorcycle">Moto</label>
      <select class="field" id="tire-pressure-motorcycle" name="motorcycle_id"
        >{#each data.motorcycles as m}<option value={m.id}>{m.name}</option
          >{/each}</select
      ><label class="field-label" for="tire-pressure-date">Data</label><input
        class="field"
        id="tire-pressure-date"
        name="date"
        type="date"
        required
      /><label class="field-label" for="tire-pressure-front"
        >PSI dianteiro</label
      ><input
        class="field"
        id="tire-pressure-front"
        name="psi_front"
        type="number"
        placeholder="PSI dianteiro"
        required
      /><label class="field-label" for="tire-pressure-rear">PSI traseiro</label
      ><input
        class="field"
        id="tire-pressure-rear"
        name="psi_rear"
        type="number"
        placeholder="PSI traseiro"
        required
      /><button class="button-secondary" type="submit" disabled={formBusy}
        >Registrar pressão</button
      >
    </form>
  </div>

  <div class="grid gap-2">
    <h2 class="display text-2xl">Produtos</h2>
    {#each data.products as product}
      <article class="panel flex min-w-0 flex-wrap justify-between gap-3 p-4">
        <span class="min-w-0 flex-1 break-words"
          >{product.manufacturer}
          {product.model_name} · {product.tire_type} ·
          {brl(Number(product.price_cents ?? 0))}</span
        >
        <form
          method="POST"
          action="?/deleteProduct"
          use:enhance={enhanceDelete}
        >
          <input type="hidden" name="id" value={product.id} /><button
            class="button-danger min-h-11"
            disabled={formBusy}>Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhum produto no catálogo.</p>
    {/each}
  </div>

  <div class="grid gap-2">
    <h2 class="display text-2xl">Calibragens</h2>
    {#each data.pressures as pressure}
      <article class="panel flex min-w-0 flex-wrap justify-between gap-3 p-4">
        <span class="min-w-0 flex-1 break-words"
          >{pressure.motorcycles?.name ?? "Moto"} · {pressure.date} · {pressure.psi_front}/{pressure.psi_rear}
          PSI</span
        >
        <form
          method="POST"
          action="?/deletePressure"
          use:enhance={enhanceDelete}
        >
          <input type="hidden" name="id" value={pressure.id} /><button
            class="button-danger min-h-11"
            disabled={formBusy}>Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhuma calibragem registrada.</p>
    {/each}
  </div>
</section>
