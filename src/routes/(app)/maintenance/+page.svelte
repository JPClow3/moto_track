<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  export let data;
</script>

<FeaturePage {...data} />
<section class="mt-6 grid gap-4 lg:grid-cols-2">
  <form
    class="panel grid gap-2 p-4"
    method="POST"
    action="?/savePart"
    use:enhance
  >
    <h2 class="font-bold">Catálogo de peças</h2>
    <input class="field" name="name" placeholder="Peça" required /><input
      class="field"
      name="manufacturer"
      placeholder="Fabricante"
    /><input
      class="field"
      name="price"
      type="number"
      step=".01"
      placeholder="Preço"
    /><input
      class="field"
      name="stock_quantity"
      type="number"
      value="0"
    /><label
      ><input name="track_stock" type="checkbox" value="true" /> Controlar estoque</label
    ><button class="button-secondary">Salvar peça</button>
  </form>
  <form
    class="panel grid gap-2 p-4"
    method="POST"
    action="?/savePlan"
    use:enhance
  >
    <h2 class="font-bold">Plano de manutenção</h2>
    <select class="field" name="motorcycle_id"
      >{#each data.motorcycles as m}<option value={m.id}>{m.name}</option
        >{/each}</select
    ><input
      class="field"
      name="maintenance_type"
      placeholder="Tipo"
      required
    /><input
      class="field"
      name="interval_km"
      type="number"
      placeholder="Intervalo km"
    /><input
      class="field"
      name="interval_days"
      type="number"
      placeholder="Intervalo dias"
    /><button class="button-secondary">Salvar plano</button>
  </form>
</section>
