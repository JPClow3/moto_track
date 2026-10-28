<script lang="ts">
  import { appCopy } from "$lib/i18n/app-copy";
  import Fuel from "lucide-svelte/icons/fuel";
  import Wrench from "lucide-svelte/icons/wrench";
  import Printer from "lucide-svelte/icons/printer";
  import { Tire, VehicleTax } from "$components/icons";
  import type { PublicSaleReport } from "$types/sale-report";
  import { locale } from "$lib/i18n/store";
  import { formatDate, formatDistance, formatMoney } from "$lib/i18n";

  export let data: { report: PublicSaleReport };

  // This dossier is opened by a prospective buyer who has no account, so it
  // follows *their* Accept-Language rather than the seller's.
  const brl = (cents: number) => formatMoney($locale, cents);
  const km = (value: number) => formatDistance($locale, value);
  const day = (iso: string) =>
    iso
      ? formatDate($locale, iso, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  $: report = data.report;
  $: moto = report.motorcycle;

  $: specs = [
    { label: "Marca", value: moto.brand },
    { label: "Modelo", value: moto.model },
    { label: "Ano", value: moto.year ? String(moto.year) : null },
    { label: "Odômetro", value: moto.odometerKm ? km(moto.odometerKm) : null },
    {
      label: "Donos anteriores",
      value: moto.previousOwners === null ? null : String(moto.previousOwners),
    },
    { label: "Perfil de uso", value: moto.ridingProfile },
  ].filter((s) => s.value);

  // Cost categories carry the categorical chart colours: never red, never a
  // status tone, so a buyer doesn't read spending as a problem.
  $: costs = [
    {
      icon: Fuel,
      label: "Combustível",
      value: report.totals.fuel,
      color: "var(--cat-fuel)",
    },
    {
      icon: Wrench,
      label: "Manutenção",
      value: report.totals.maintenance,
      color: "var(--cat-maintenance)",
    },
    {
      icon: Tire,
      label: "Pneus",
      value: report.totals.tires,
      color: "var(--cat-tires)",
    },
    {
      icon: VehicleTax,
      label: "Taxas",
      value: report.totals.fees,
      color: "var(--cat-fees)",
    },
  ];
</script>

<svelte:head>
  <title>{moto.name || appCopy($locale, "Dossiê de venda")} · Moto Track</title>
  <!-- A private share link should never end up in a search index. -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<article class="sale-report mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
  <header class="flex flex-wrap items-start justify-between gap-6">
    <div class="min-w-0">
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>
        {appCopy($locale, "Dossiê de venda")}
      </p>
      <h1 class="display mt-3 text-5xl sm:text-6xl">
        {moto.name || appCopy($locale, "Histórico da moto")}
      </h1>
      <p class="mt-3 text-[var(--muted)]">
        {appCopy(
          $locale,
          "Histórico registrado no Moto Track e compartilhado pelo proprietário.",
        )}
      </p>
    </div>
    <button
      type="button"
      class="button-secondary shrink-0 print:hidden"
      on:click={() => window.print()}
    >
      <Printer size={20} aria-hidden="true" />
      {appCopy($locale, "Imprimir relatório")}
    </button>
  </header>

  {#if specs.length}
    <dl
      class="specs mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3"
    >
      {#each specs as spec (spec.label)}
        <div class="min-w-0 bg-[var(--panel)] p-4 sm:p-5">
          <dt class="label-tech text-[var(--muted)]">
            {appCopy($locale, spec.label)}
          </dt>
          <dd class="display numeric mt-2 break-words text-2xl">
            {spec.value}
          </dd>
        </div>
      {/each}
    </dl>
  {/if}

  <!-- Cost of ownership — the reason a buyer opens this link. -->
  <section class="mt-14 break-inside-avoid">
    <h2 class="display text-3xl">{appCopy($locale, "Custo registrado")}</h2>
    <p class="mt-2 text-sm text-[var(--muted)]">
      {appCopy(
        $locale,
        "Somatório de tudo que o proprietário lançou para esta moto.",
      )}
    </p>

    <div class="costs mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {#each costs as cost (cost.label)}
        <div class="panel min-w-0 p-4 sm:p-5">
          <div class="flex items-center gap-2 text-[var(--muted)]">
            <svelte:component
              this={cost.icon}
              size={16}
              class="shrink-0"
              style={`color:${cost.color}`}
              aria-hidden="true"
            />
            <p class="label-tech">{appCopy($locale, cost.label)}</p>
          </div>
          <p class="display numeric mt-3 break-words text-2xl sm:text-3xl">
            {brl(cost.value)}
          </p>
        </div>
      {/each}
    </div>

    <div
      class="total mt-4 flex flex-col gap-4 rounded-panel bg-[var(--panel-invert)] p-6 text-paper sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="label-tech text-paper/70">
          {appCopy($locale, "Total investido")}
        </p>
        <p class="display numeric mt-1 text-5xl">
          {brl(report.totals.all)}
        </p>
      </div>
      <div class="sm:text-right">
        <p class="label-tech text-paper/70">
          {appCopy($locale, "Serviços registrados")}
        </p>
        <p class="display numeric mt-1 text-5xl">{report.serviceCount}</p>
      </div>
    </div>
  </section>

  <!-- Maintenance history -->
  <section class="mt-14">
    <h2 class="display text-3xl">
      {appCopy($locale, "Histórico de manutenção")}
    </h2>
    {#if report.timeline.length < report.serviceCount}
      <!-- Say so rather than let a capped table read as the whole history. -->
      <p class="mt-2 text-sm text-[var(--muted)]">
        {appCopy($locale, "Exibindo os")}
        {report.timeline.length}
        {appCopy($locale, "serviços mais recentes de")}
        {report.serviceCount}.
      </p>
    {/if}

    {#if report.timeline.length}
      <div class="data-table panel mt-6 overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead
            class="border-b border-[var(--line)] bg-[var(--panel-sunken)] text-[var(--muted)]"
          >
            <tr>
              <th scope="col" class="label-tech px-4 py-3"
                >{appCopy($locale, "Data")}</th
              >
              <th scope="col" class="label-tech px-4 py-3"
                >{appCopy($locale, "Serviço")}</th
              >
              <th scope="col" class="label-tech px-4 py-3"
                >{appCopy($locale, "Odômetro")}</th
              >
              <th scope="col" class="label-tech px-4 py-3 text-right"
                >{appCopy($locale, "Custo")}</th
              >
            </tr>
          </thead>
          <tbody>
            {#each report.timeline as event, i (i)}
              <tr class="border-b border-[var(--line)] last:border-0">
                <td
                  data-label={appCopy($locale, "Data")}
                  class="numeric whitespace-nowrap px-4 py-3 text-[var(--muted)]"
                  >{day(event.date)}</td
                >
                <td data-label={appCopy($locale, "Serviço")} class="px-4 py-3">
                  <div class="min-w-0">
                    <p class="font-semibold">
                      {event.type || appCopy($locale, "Manutenção")}
                    </p>
                    {#if event.description}
                      <p class="mt-0.5 text-xs text-[var(--muted)]">
                        {event.description}
                      </p>
                    {/if}
                  </div>
                </td>
                <td
                  data-label={appCopy($locale, "Odômetro")}
                  class="numeric whitespace-nowrap px-4 py-3 text-[var(--muted)]"
                >
                  {event.odometerKm === null ? "—" : km(event.odometerKm)}
                </td>
                <td
                  data-label={appCopy($locale, "Custo")}
                  class="numeric whitespace-nowrap px-4 py-3 text-right font-semibold"
                >
                  {brl(event.costCents)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="panel mt-6 p-8 text-center text-[var(--muted)]">
        {appCopy($locale, "Nenhuma manutenção registrada para esta moto.")}
      </p>
    {/if}
  </section>

  <footer
    class="mt-14 flex flex-col gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-xs text-[var(--muted)]">
      {appCopy($locale, "Link válido até")}
      {day(report.expiresAt)}{appCopy(
        $locale,
        ". O proprietário pode revogá-lo a qualquer momento.",
      )}
    </p>
    <a class="button-secondary shrink-0 print:hidden" href="/"
      >{appCopy($locale, "Criar meu histórico no Moto Track")}</a
    >
  </footer>
</article>

<style>
  @media print {
    /* Paper is the buyer's copy: drop the site chrome around this page (the
       public layout renders it as siblings of <main>), and print light
       surfaces with plain hairlines instead of shadows and dark fills. */
    :global(div:has(> #main-content > .sale-report) > :not(#main-content)) {
      display: none !important;
    }

    .sale-report {
      max-width: none;
      padding: 0;
      color: #000;
    }

    .sale-report :global(.panel) {
      box-shadow: none;
      background: #fff;
      border-color: #d4d4d8;
    }

    .specs {
      background: #d4d4d8;
    }

    .specs > div {
      background: #fff;
    }

    .costs {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .total {
      background: #fff;
      color: #000;
      border: 1px solid #000;
    }

    .total .label-tech {
      color: #52525b;
    }

    tr {
      break-inside: avoid;
    }

    thead {
      display: table-header-group;
    }
  }
</style>
