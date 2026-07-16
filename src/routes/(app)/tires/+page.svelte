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
</section>
