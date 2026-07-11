<script lang="ts">
  import FeaturePage from '$components/FeaturePage.svelte';
  import MetricCard from '$components/MetricCard.svelte';
  export let data;
  export let form;
  const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
</script>
<div class="mb-6 grid gap-4 md:grid-cols-4">
  <MetricCard label="Fuel" value={brl(data.totals.fuel)} />
  <MetricCard label="Maintenance" value={brl(data.totals.maintenance)} />
  <MetricCard label="Tires" value={brl(data.totals.tires)} />
  <MetricCard label="Expenses" value={brl(data.totals.expenses)} />
</div>

{#if form?.publicUrl}
  <div class="panel mb-6 p-4">
    <p class="text-sm font-semibold">Link público criado</p>
    <a class="mt-2 block break-all text-sm text-signal" href={form.publicUrl}>{form.publicUrl}</a>
  </div>
{/if}

<div class="panel mb-6 p-4">
  <h2 class="text-lg font-semibold">Dossiê público de venda</h2>
  <form class="mt-3 grid gap-3 md:grid-cols-[1fr_120px_auto]" method="POST" action="?/createShare">
    <select class="field" name="motorcycle_id" required>
      <option value="">Escolha a moto</option>
      {#each data.motorcycles as moto}
        <option value={moto.id}>{moto.name} · {moto.brand} {moto.model} {moto.year}</option>
      {/each}
    </select>
    <input class="field" type="number" name="days" min="1" value="14" />
    <button class="button-primary" type="submit">Criar link</button>
  </form>
</div>

<FeaturePage {...data} />
