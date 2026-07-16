<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  export let data;
  const money = (c: number) => formatMoney($locale, c);
</script>

<svelte:head
  ><title>Dossiê de venda · {data.motorcycle.name}</title></svelte:head
>
<section class="print-report mx-auto max-w-3xl space-y-6">
  <header>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>Moto Track · dossiê de
      venda
    </p>
    <h1 class="display text-4xl">{data.motorcycle.name}</h1>
    <p>
      {data.motorcycle.brand}
      {data.motorcycle.model} · {data.motorcycle.year} · {data.motorcycle
        .current_odometer_km} km
    </p>
  </header>
  <div class="grid gap-3 sm:grid-cols-2">
    <article class="panel p-4">
      Combustível<strong class="block text-2xl"
        >{money(data.totals.fuel)}</strong
      >
    </article>
    <article class="panel p-4">
      Manutenção<strong class="block text-2xl"
        >{money(data.totals.maintenance)}</strong
      >
    </article>
    <article class="panel p-4">
      Pneus<strong class="block text-2xl">{money(data.totals.tires)}</strong>
    </article>
    <article class="panel p-4">
      Taxas<strong class="block text-2xl">{money(data.totals.fees)}</strong>
    </article>
  </div>
  <button class="button-primary print:hidden" onclick={() => window.print()}
    >Salvar como PDF</button
  >
</section>

<style>
  @media print {
    .print\:hidden {
      display: none;
    }
    .print-report {
      max-width: none;
    }
    .panel {
      border: 1px solid #ccc;
    }
  }
</style>
