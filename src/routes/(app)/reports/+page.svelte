<script lang="ts">
  import FeaturePage from '$components/FeaturePage.svelte';
  import MetricCard from '$components/MetricCard.svelte';
  export let data;
  const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
</script>
<div class="mb-6 grid gap-4 md:grid-cols-4">
  <MetricCard label="Fuel" value={brl(data.totals.fuel)} />
  <MetricCard label="Maintenance" value={brl(data.totals.maintenance)} />
  <MetricCard label="Tires" value={brl(data.totals.tires)} />
  <MetricCard label="Expenses" value={brl(data.totals.expenses)} />
</div>
<FeaturePage {...data} />
