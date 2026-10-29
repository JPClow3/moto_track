<script lang="ts">
  import { appCopy } from "$lib/i18n/app-copy";
  import { locale } from "$lib/i18n/store";
  import { formatDistance, formatMoney } from "$lib/i18n";
  export let data;
  const money = (c: number) => formatMoney($locale, c);
</script>

<svelte:head
  ><title>{appCopy($locale, "Dossiê de venda ·")} {data.motorcycle.name}</title
  ></svelte:head
>
<section class="print-report mx-auto max-w-3xl space-y-6">
  <header>
    <p class="label-tech text-[var(--muted)]">
      {appCopy($locale, "Moto Track · dossiê de venda")}
    </p>
    <h1 class="display text-4xl">{data.motorcycle.name}</h1>
    <p>
      {data.motorcycle.brand}
      {data.motorcycle.model} · {data.motorcycle.year} · {formatDistance(
        $locale,
        Number(data.motorcycle.current_odometer_km),
      )}
    </p>
  </header>
  <div class="grid gap-3 sm:grid-cols-2">
    <article class="panel p-4">
      <span class="flex items-center gap-2 text-sm text-[var(--muted)]">
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--cat-fuel)]"
          aria-hidden="true"
        ></span>{appCopy($locale, "Combustível")}
      </span>
      <strong class="display numeric mt-1 block text-2xl"
        >{money(data.totals.fuel)}</strong
      >
    </article>
    <article class="panel p-4">
      <span class="flex items-center gap-2 text-sm text-[var(--muted)]">
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--cat-maintenance)]"
          aria-hidden="true"
        ></span>{appCopy($locale, "Manutenção")}
      </span>
      <strong class="display numeric mt-1 block text-2xl"
        >{money(data.totals.maintenance)}</strong
      >
    </article>
    <article class="panel p-4">
      <span class="flex items-center gap-2 text-sm text-[var(--muted)]">
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--cat-tires)]"
          aria-hidden="true"
        ></span>{appCopy($locale, "Pneus")}
      </span>
      <strong class="display numeric mt-1 block text-2xl"
        >{money(data.totals.tires)}</strong
      >
    </article>
    <article class="panel p-4">
      <span class="flex items-center gap-2 text-sm text-[var(--muted)]">
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--cat-fees)]"
          aria-hidden="true"
        ></span>{appCopy($locale, "Taxas")}
      </span>
      <strong class="display numeric mt-1 block text-2xl"
        >{money(data.totals.fees)}</strong
      >
    </article>
  </div>
  <button class="button-primary print:hidden" onclick={() => window.print()}
    >{appCopy($locale, "Salvar como PDF")}</button
  >
</section>

<style>
  @media print {
    :global(aside),
    :global(header.sticky),
    :global(.mobile-bottom-nav),
    :global(#app-mobile-nav) {
      display: none !important;
    }

    :global(main#main-content) {
      max-width: none !important;
      padding: 0 !important;
    }

    :global(.lg\:pl-72) {
      padding-left: 0 !important;
    }

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
