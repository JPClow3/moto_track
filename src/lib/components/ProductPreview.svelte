<script lang="ts" module>
  export type PreviewView = "overview" | "fuel" | "maintenance" | "reminders";
  export const PREVIEW_VIEWS: PreviewView[] = [
    "overview",
    "fuel",
    "maintenance",
    "reminders",
  ];
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { locale } from "$lib/i18n/store";
  import {
    formatDate,
    formatDistance,
    formatMoney,
    formatNumber,
  } from "$lib/i18n";
  import { publicCopy } from "$lib/i18n/public-copy";
  import MetricCard from "./MetricCard.svelte";
  import StatusBadge from "./ui/StatusBadge.svelte";
  import { OilCan, Tire, VehicleDocument } from "./icons";
  import Gauge from "lucide-svelte/icons/gauge";
  import Fuel from "lucide-svelte/icons/fuel";
  import Wrench from "lucide-svelte/icons/wrench";
  import Bell from "lucide-svelte/icons/bell";
  import Check from "lucide-svelte/icons/check";

  /**
   * `interactive` (default) renders the tabbed demo used on /demo. With
   * `interactive={false}` it renders one view as a static illustration, for
   * the landing's product sections: no tabs, no photo header, no page-level
   * id, and no headings that would compete with the section's own.
   */
  let {
    initial = "overview",
    interactive = true,
  }: { initial?: string; interactive?: boolean } = $props();

  const isView = (value: string): value is PreviewView =>
    (PREVIEW_VIEWS as string[]).includes(value);

  let selected = $state<PreviewView>(
    untrack(() => (isView(initial) ? initial : "overview")),
  );

  const c = (source: string) => publicCopy($locale, source);
  const decimal = (value: number) =>
    formatNumber($locale, value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });

  const views = [
    { id: "overview", label: "Visão geral", icon: Gauge },
    { id: "fuel", label: "Combustível", icon: Fuel },
    { id: "maintenance", label: "Manutenção", icon: Wrench },
    { id: "reminders", label: "Lembretes", icon: Bell },
  ] as const;

  function tabKey(event: KeyboardEvent, index: number) {
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
    event.preventDefault();
    const next =
      key === "Home"
        ? 0
        : key === "End"
          ? views.length - 1
          : (index + (key === "ArrowRight" ? 1 : -1) + views.length) %
            views.length;
    selected = views[next].id;
    const tabs = (
      event.currentTarget as HTMLElement
    ).parentElement?.querySelectorAll<HTMLButtonElement>("button");
    tabs?.[next]?.focus();
  }

  // ── Sample data ────────────────────────────────────────────────────────
  const months = [
    { month: "2026-04", cents: 24800 },
    { month: "2026-05", cents: 31200 },
    { month: "2026-06", cents: 26500 },
    { month: "2026-07", cents: 28900 },
    { month: "2026-08", cents: 23100 },
    { month: "2026-09", cents: 21900 },
  ];
  const peak = Math.max(...months.map((m) => m.cents));
  const total = months.reduce((sum, m) => sum + m.cents, 0);

  // Categorical colours, never red and never a status tone.
  const categories = [
    { label: "Combustível", share: 58, color: "var(--cat-fuel)" },
    { label: "Manutenção", share: 27, color: "var(--cat-maintenance)" },
    { label: "Pneus", share: 9, color: "var(--cat-tires)" },
    { label: "Taxas", share: 6, color: "var(--cat-fees)" },
  ];

  const economy = [28.6, 30.2, 29.8, 31.4, 30.8, 32.1];
  const W = 320;
  const H = 96;
  const lo = Math.min(...economy) - 0.6;
  const hi = Math.max(...economy) + 0.6;
  const trend = economy.map((value, i) => ({
    x: 8 + (i * (W - 16)) / (economy.length - 1),
    y: 8 + (1 - (value - lo) / (hi - lo)) * (H - 16),
  }));
  const linePath = trend
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${trend[trend.length - 1].x} ${H} L${trend[0].x} ${H} Z`;
  const lastPoint = trend[trend.length - 1];

  const services = [
    { title: "Troca de óleo e filtro", km: 12000, cost: 14800 },
    { title: "Inspeção dos freios", km: 11500, cost: 6500 },
    { title: "Relação e corrente lubrificadas", km: 10800, cost: 4200 },
  ];
</script>

<!-- In the static mode the surrounding section already headlines the view, so
     the inner title would only repeat it. -->
{#snippet title(text: string)}
  {#if interactive}
    <h3 class="display mb-5 text-3xl">{c(text)}</h3>
  {/if}
{/snippet}

{#snippet body(view: PreviewView)}
  {#if view === "overview"}
    {@render title("Cada quilômetro conta.")}
    <div class="grid grid-cols-2 gap-3">
      <MetricCard
        label={c("Custo / km")}
        value={formatMoney($locale, 41)}
        detail={c("Exemplo de custo total")}
      />
      <MetricCard
        label={c("Consumo médio")}
        value={`${decimal(30.5)} km/L`}
        detail={c("Abastecimentos completos")}
      />
    </div>
    <section class="panel mt-4 p-5" aria-label={c("Custos por mês")}>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="label-tech text-[var(--muted)]">{c("Custos por mês")}</p>
          <p class="display numeric mt-1 text-3xl">
            {formatMoney($locale, total)}
          </p>
        </div>
        <p class="text-xs text-[var(--muted)]">{c("Últimos 6 meses")}</p>
      </div>
      <div class="mt-4 flex h-28 items-end gap-2" aria-hidden="true">
        {#each months as entry, i (entry.month)}
          <div class="flex h-full flex-1 flex-col justify-end gap-1.5">
            <div
              class="bar"
              class:is-latest={i === months.length - 1}
              style={`height:${(entry.cents / peak) * 100}%`}
            ></div>
            <p class="text-center text-xs text-[var(--muted)]">
              {formatDate($locale, `${entry.month}-01`, { month: "short" })}
            </p>
          </div>
        {/each}
      </div>
      <div class="mt-5 flex h-2 overflow-hidden rounded-full">
        {#each categories as category (category.label)}
          <span style={`width:${category.share}%;background:${category.color}`}
          ></span>
        {/each}
      </div>
      <ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {#each categories as category (category.label)}
          <li class="flex items-center gap-2">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              style={`background:${category.color}`}
              aria-hidden="true"
            ></span>
            <span class="text-[var(--muted)]">{c(category.label)}</span>
            <span class="numeric ml-auto font-semibold">{category.share}%</span>
          </li>
        {/each}
      </ul>
    </section>
  {:else if view === "fuel"}
    {@render title("Saiba quanto custa rodar.")}
    <div class="grid grid-cols-2 gap-3">
      <MetricCard
        label={c("Último abastecimento")}
        value={formatMoney($locale, 8420)}
        detail={`${decimal(14.06)} L`}
      />
      <MetricCard
        label={c("Consumo")}
        value={`${decimal(32.1)} km/L`}
        detail={c("Último tanque completo")}
      />
    </div>
    <section class="panel mt-4 p-5" aria-label={c("Evolução do consumo")}>
      <p class="label-tech text-[var(--muted)]">{c("Evolução do consumo")}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        class="mt-3 h-24 w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={areaPath} class="trend-area" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--cat-fuel)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="4"
          fill="var(--cat-fuel)"
        />
      </svg>
      <p class="mt-2 text-xs text-[var(--muted)]">
        {c("Últimos seis tanques completos")}
      </p>
    </section>
    <p class="mt-4 text-sm text-[var(--muted)]">
      {c("Registre litros, valor, hodômetro e recibo em um só lugar.")}
    </p>
  {:else if view === "maintenance"}
    {@render title("Histórico que acompanha a moto.")}
    <img
      src="/images/launch/workshop-care.webp"
      width="1536"
      height="1024"
      alt={c("Inspeção do freio e pneu em uma oficina")}
      class="mb-2 h-36 w-full rounded object-cover"
      loading="lazy"
    />
    <ul>
      {#each services as service (service.title)}
        <li
          class="flex items-center gap-3 border-b border-[var(--line)] py-3.5 last:border-0"
        >
          <Check size={20} class="shrink-0 text-success" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{c(service.title)}</p>
            <p class="numeric text-xs text-[var(--muted)]">
              {formatDistance($locale, service.km)}
            </p>
          </div>
          <span class="numeric text-sm font-semibold"
            >{formatMoney($locale, service.cost)}</span
          >
        </li>
      {/each}
    </ul>
  {:else}
    {@render title("A próxima revisão, à vista.")}
    <div class="panel p-5">
      <div class="flex items-start justify-between gap-3">
        <OilCan size={24} class="shrink-0 text-[var(--muted)]" />
        <StatusBadge tone="due">{c("Em breve")}</StatusBadge>
      </div>
      <p class="label-tech mt-4 text-[var(--muted)]">{c("Próximo cuidado")}</p>
      <p class="display mt-1 text-3xl">{c("Óleo do motor")}</p>
      <p class="numeric mt-2 text-sm">{c("Em 520 km")}</p>
      <div
        class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
        aria-hidden="true"
      >
        <div class="h-full w-[87%] rounded-full bg-[var(--warning)]"></div>
      </div>
    </div>
    <ul class="mt-3 grid gap-3">
      <li class="panel flex items-center gap-3 p-4">
        <VehicleDocument size={20} class="shrink-0 text-[var(--muted)]" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{c("Licenciamento")}</p>
          <p class="text-xs text-[var(--muted)]">
            {c("Lembrete por data, com vínculo ao documento.")}
          </p>
        </div>
        <StatusBadge tone="ok">{c("Em dia")}</StatusBadge>
      </li>
      <li class="panel flex items-center gap-3 p-4">
        <Tire size={20} class="shrink-0 text-[var(--muted)]" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{c("Calibragem dos pneus")}</p>
          <p class="text-xs text-[var(--muted)]">
            {c("A cada 15 dias")}
          </p>
        </div>
        <StatusBadge tone="overdue">{c("Atrasado")}</StatusBadge>
      </li>
    </ul>
    <p class="mt-4 text-sm text-[var(--muted)]">
      {c(
        "Organize por data ou quilometragem. Consulte sempre o manual da sua moto.",
      )}
    </p>
  {/if}
{/snippet}

{#if interactive}
  <div
    id="product-preview"
    class="preview overflow-hidden rounded border border-[var(--line)] bg-[var(--bg)]"
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-5 py-3"
    >
      <span class="label-tech">Moto Track</span><span
        class="text-xs text-[var(--muted)]">{c("Dados de exemplo")}</span
      >
    </div>
    <div class="relative h-44 overflow-hidden bg-ink sm:h-52">
      <img
        src="/images/launch/serra-road.webp"
        alt={c("Moto cinza estacionada numa estrada de serra ao amanhecer")}
        width="1536"
        height="1024"
        class="h-full w-full object-cover object-[center_58%]"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"
      ></div>
      <div class="absolute inset-x-5 bottom-5 text-white">
        <p class="label-tech text-white/75">{c("Minha garagem")}</p>
        <div class="mt-1 flex items-end justify-between gap-3">
          <h2 class="display text-4xl">{c("Minha moto")}</h2>
          <span class="numeric text-sm">{formatDistance($locale, 12480)}</span>
        </div>
      </div>
    </div>
    <div
      class="grid grid-cols-4 border-b border-[var(--line)]"
      role="tablist"
      aria-label={c("Explorar demonstração")}
    >
      {#each views as view, index (view.id)}
        <button
          type="button"
          role="tab"
          id={`preview-tab-${view.id}`}
          aria-selected={selected === view.id}
          tabindex={selected === view.id ? 0 : -1}
          onkeydown={(event) => tabKey(event, index)}
          aria-controls={`preview-panel-${view.id}`}
          class="focus-ring flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 border-b-2 px-1 text-xs font-semibold sm:text-sm {selected ===
          view.id
            ? 'border-[var(--fg)] bg-[var(--accent-wash)] text-[var(--fg)]'
            : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'}"
          onclick={() => (selected = view.id)}
        >
          <view.icon size={20} aria-hidden="true" />
          <span class="max-w-full truncate">{c(view.label)}</span>
        </button>
      {/each}
    </div>
    <div
      id={`preview-panel-${selected}`}
      role="tabpanel"
      aria-labelledby={`preview-tab-${selected}`}
      tabindex="0"
      class="focus-ring p-4 sm:p-6"
    >
      {@render body(selected)}
    </div>
    <p
      class="border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--muted)]"
    >
      {c("Demonstração ilustrativa. Nenhum registro é salvo.")}
    </p>
  </div>
{:else}
  <figure
    class="preview overflow-hidden rounded border border-[var(--line)] bg-[var(--bg)]"
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-5 py-3"
    >
      <span class="label-tech">Moto Track</span><span
        class="text-xs text-[var(--muted)]">{c("Dados de exemplo")}</span
      >
    </div>
    <div class="p-4 sm:p-6">
      {@render body(selected)}
    </div>
  </figure>
{/if}

<style>
  .preview {
    box-shadow: 0 24px 70px -35px rgb(var(--shadow-color) / 0.35);
  }

  /* Past months stay graphite; the latest is ink, not red: a cost chart is not
     an alert. */
  .bar {
    min-height: 2px;
    border-radius: 2px 2px 0 0;
    background: color-mix(in srgb, var(--fg) 18%, transparent);
  }

  .bar.is-latest {
    background: var(--fg);
  }

  .trend-area {
    fill: var(--cat-fuel);
    opacity: 0.12;
  }
</style>
