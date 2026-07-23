<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import { locale } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
</script>

<FeaturePage {...data} errorMessage={form?.message || data.errorMessage} />
<section class="mt-6 grid gap-6">
  <div class="grid gap-4 lg:grid-cols-2">
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/saveProduct"
      use:enhance
    >
      <h2 class="font-bold">Catálogo de pneus</h2>
      <input
        class="field"
        name="manufacturer"
        placeholder="Fabricante"
        required
      /><input
        class="field"
        name="model_name"
        placeholder="Modelo"
        required
      /><input class="field" name="tire_type" placeholder="Tipo" /><input
        class="field"
        name="price"
        type="number"
        step=".01"
        placeholder="Preço"
      /><button class="button-secondary">Salvar produto</button>
    </form>
    <form
      class="panel grid gap-2 p-4"
      method="POST"
      action="?/savePressure"
      use:enhance
    >
      <h2 class="font-bold">Pressão</h2>
      <select class="field" name="motorcycle_id"
        >{#each data.motorcycles as m}<option value={m.id}>{m.name}</option
          >{/each}</select
      ><input class="field" name="date" type="date" required /><input
        class="field"
        name="psi_front"
        type="number"
        placeholder="PSI dianteiro"
        required
      /><input
        class="field"
        name="psi_rear"
        type="number"
        placeholder="PSI traseiro"
        required
      /><button class="button-secondary">Registrar pressão</button>
    </form>
  </div>

  <div class="grid gap-2">
    <h2 class="display text-2xl">Produtos</h2>
    {#each data.products as product}
      <article class="panel flex justify-between gap-3 p-4">
        <span
          >{product.manufacturer}
          {product.model_name} · {product.tire_type} ·
          {brl(product.price_cents ?? 0)}</span
        >
        <form method="POST" action="?/deleteProduct" use:enhance>
          <input type="hidden" name="id" value={product.id} /><button
            class="button-danger">Excluir</button
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
      <article class="panel flex justify-between gap-3 p-4">
        <span
          >{pressure.motorcycles?.name ?? "Moto"} · {pressure.date} · {pressure.psi_front}/{pressure.psi_rear}
          PSI</span
        >
        <form method="POST" action="?/deletePressure" use:enhance>
          <input type="hidden" name="id" value={pressure.id} /><button
            class="button-danger">Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhuma calibragem registrada.</p>
    {/each}
  </div>
</section>
