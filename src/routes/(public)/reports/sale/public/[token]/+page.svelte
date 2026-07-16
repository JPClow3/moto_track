<script lang="ts">
  import { Fuel, Wrench, CircleGauge, ReceiptText } from "lucide-svelte";
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

  $: costs = [
    { icon: Fuel, label: "Combustível", value: report.totals.fuel },
    { icon: Wrench, label: "Manutenção", value: report.totals.maintenance },
    { icon: CircleGauge, label: "Pneus", value: report.totals.tires },
    { icon: ReceiptText, label: "Taxas", value: report.totals.fees },
  ];
</script>

<svelte:head>
  <title>{moto.name || "Dossiê de venda"} · Moto Track</title>
  <!-- A private share link should never end up in a search index. -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<article class="mx-auto max-w-4xl px-6 py-16">
  <header>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>
      Dossiê de venda
    </p>
    <h1 class="display mt-3 text-5xl sm:text-6xl">
      {moto.name || "Histórico da moto"}
    </h1>
    <p class="mt-3 text-[var(--muted)]">
      Histórico registrado no Moto Track e compartilhado pelo proprietário.
    </p>
  </header>

  {#if specs.length}
    <dl
      class="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3"
    >
      {#each specs as spec (spec.label)}
        <div class="bg-[var(--bg)] p-5">
          <dt class="label-tech text-[var(--muted)]">{spec.label}</dt>
          <dd class="display numeric mt-2 text-2xl">{spec.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}

  <!-- Cost of ownership — the reason a buyer opens this link. -->
  <section class="mt-14">
    <h2 class="display text-3xl">Custo registrado</h2>
    <p class="mt-2 text-sm text-[var(--muted)]">
      Somatório de tudo que o proprietário lançou para esta moto.
    </p>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each costs as cost (cost.label)}
        <div class="panel p-5">
          <div class="flex items-center gap-2 text-[var(--muted)]">
            <svelte:component this={cost.icon} class="h-4 w-4" />
            <p class="label-tech">{cost.label}</p>
          </div>
          <p class="display numeric mt-3 text-3xl">{brl(cost.value)}</p>
        </div>
      {/each}
    </div>

    <div
      class="mt-4 flex flex-col gap-4 rounded-panel bg-[var(--panel-invert)] p-6 text-paper sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="label-tech text-paper/50">Total investido</p>
        <p class="display numeric mt-1 text-5xl text-[var(--accent)]">
          {brl(report.totals.all)}
        </p>
      </div>
      <div class="sm:text-right">
        <p class="label-tech text-paper/50">Serviços registrados</p>
        <p class="display numeric mt-1 text-5xl">{report.serviceCount}</p>
      </div>
    </div>
  </section>

  <!-- Maintenance history -->
  <section class="mt-14">
    <h2 class="display text-3xl">Histórico de manutenção</h2>
    {#if report.timeline.length < report.serviceCount}
      <!-- Say so rather than let a capped table read as the whole history. -->
      <p class="mt-2 text-sm text-[var(--muted)]">
        Exibindo os {report.timeline.length} serviços mais recentes de {report.serviceCount}.
      </p>
    {/if}

    {#if report.timeline.length}
      <div class="panel mt-6 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th class="label-tech px-4 py-3">Data</th>
                <th class="label-tech px-4 py-3">Serviço</th>
                <th class="label-tech px-4 py-3">Odômetro</th>
                <th class="label-tech px-4 py-3 text-right">Custo</th>
              </tr>
            </thead>
            <tbody>
              {#each report.timeline as event, i (i)}
                <tr class="border-b border-[var(--line)] last:border-0">
                  <td
                    class="numeric whitespace-nowrap px-4 py-3 text-[var(--muted)]"
                    >{day(event.date)}</td
                  >
                  <td class="px-4 py-3">
                    <p class="font-semibold">{event.type || "Manutenção"}</p>
                    {#if event.description}
                      <p class="mt-0.5 text-xs text-[var(--muted)]">
                        {event.description}
                      </p>
                    {/if}
                  </td>
                  <td
                    class="numeric whitespace-nowrap px-4 py-3 text-[var(--muted)]"
                  >
                    {event.odometerKm === null ? "—" : km(event.odometerKm)}
                  </td>
                  <td
                    class="numeric whitespace-nowrap px-4 py-3 text-right font-semibold"
                  >
                    {brl(event.costCents)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else}
      <p class="panel mt-6 p-8 text-center text-[var(--muted)]">
        Nenhuma manutenção registrada para esta moto.
      </p>
    {/if}
  </section>

  <footer
    class="mt-14 flex flex-col gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-xs text-[var(--muted)]">
      Link válido até {day(report.expiresAt)}. O proprietário pode revogá-lo a
      qualquer momento.
    </p>
    <a class="button-secondary shrink-0" href="/"
      >Criar meu histórico no Moto Track</a
    >
  </footer>
</article>
