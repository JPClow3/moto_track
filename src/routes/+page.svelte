<script lang="ts">
  import { publicCopy } from "$lib/i18n/public-copy";
  import Wrench from "lucide-svelte/icons/wrench";
  import Fuel from "lucide-svelte/icons/fuel";
  import Bell from "lucide-svelte/icons/bell";
  import Briefcase from "lucide-svelte/icons/briefcase";
  import Gauge from "lucide-svelte/icons/gauge";
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import PublicHeader from "$components/PublicHeader.svelte";
  import PublicFooter from "$components/PublicFooter.svelte";
  import ProductPreview from "$components/ProductPreview.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { Motorcycle, OilCan, Tire, VehicleTax } from "$components/icons";
  import type { PlanPrice, ProPricing } from "$types/billing";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney, formatDistance } from "$lib/i18n";

  // See the note in $types/billing: the price carries no pre-formatted string,
  // because the server-side pricing cache is shared across readers.
  function planPrice(price: PlanPrice) {
    return formatMoney($locale, price.amountCents, price.currency);
  }

  type Article = { title: string; slug: string; summary: string };

  export let data: { pricing: ProPricing; articles: Article[] };

  // The real product, one view per section: each row pairs a static
  // ProductPreview view with a short headline. Rows alternate sides on
  // desktop and stack on mobile.
  const sections = [
    {
      view: "overview",
      icon: Gauge,
      label: "Visão geral",
      title: "Saiba quanto a moto custa de verdade",
      body: "Custo por km, consumo médio e gastos por mês e por categoria, calculados a partir dos registros que você já faz.",
      points: [
        "Combustível, peças e taxas no mesmo custo por km",
        "Gastos por mês e por categoria",
        "Exportação em CSV quando precisar",
      ],
    },
    {
      view: "fuel",
      icon: Fuel,
      label: "Combustível",
      title: "Custos & Combustível",
      body: "Acompanhe cada abastecimento, visualize seu custo por km real e anexe recibos sem planilha nenhuma.",
      points: [
        "Consumo calculado a cada tanque cheio",
        "Foto do cupom preenche os campos",
        "Rascunhos guardados sem internet",
      ],
    },
    {
      view: "maintenance",
      icon: Wrench,
      label: "Manutenção",
      title: "Histórico que acompanha a moto.",
      body: "Registre peças, serviços e desgaste dos pneus. Um histórico completo que vira valor na hora da revenda.",
      points: [
        "Planos de manutenção por km ou por data",
        "Fotos e notas fiscais anexadas ao serviço",
        "Relatório de venda para mostrar ao comprador",
      ],
    },
    {
      view: "reminders",
      icon: Bell,
      label: "Lembretes",
      title: "A próxima revisão, à vista.",
      body: "Nunca mais perca uma troca de óleo ou o IPVA. Alertas por quilometragem rodada ou por data.",
      points: [
        "Vencimento por km rodado ou por data",
        "Aviso por e-mail e notificação no celular",
      ],
    },
  ];

  // Each line is a list of segments so the emphasised part can be marked up
  // without {@html}.
  type Segment = { t: string; b?: boolean };

  const freePlan: Segment[][] = [
    [{ t: "Gestão de " }, { t: "1 moto ativa", b: true }],
    [{ t: "Até 3 uploads de recibos e fotos" }],
    [{ t: "3 lembretes ativos simultâneos" }],
    [{ t: "3 turnos profissionais por mês" }],
  ];

  const proPlan: Segment[][] = [
    [{ t: "Motos ilimitadas", b: true }, { t: " na garagem" }],
    [{ t: "Uploads e anexos ilimitados", b: true }],
    [{ t: "Lembretes ilimitados", b: true }],
    [{ t: "Turnos ilimitados", b: true }, { t: " para profissionais" }],
    [{ t: "Relatório de venda com selo Pro" }],
  ];
</script>

<svelte:head>
  <title
    >{publicCopy($locale, "Moto Track — Centro de Comando da sua Moto")}</title
  >
  <meta
    name="description"
    content={publicCopy(
      $locale,
      "Controle de combustível, manutenção, pneus, documentos e lembretes para a sua moto.",
    )}
  />
  <link rel="canonical" href="https://moto-track.net/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Moto Track" />
  <meta
    property="og:title"
    content={publicCopy($locale, "Moto Track — Centro de Comando da sua Moto")}
  />
  <meta
    property="og:description"
    content={publicCopy(
      $locale,
      "Controle de combustível, manutenção, pneus, documentos e lembretes para a sua moto.",
    )}
  />
  <meta property="og:url" content="https://moto-track.net/" />
  <meta
    property="og:image"
    content="https://moto-track.net/brand/og-card.png"
  />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="landing">
  <a class="skip-link" href="#landing-main">{$t("a11y.skipToContent")}</a>
  <PublicHeader />

  <main id="landing-main" tabindex="-1">
    <!-- ── HERO ──────────────────────────────────────────────────
         Text and CTAs are static: they are complete on the first painted
         frame. Only the product card moves, and only by translation. -->
    <section class="relative overflow-hidden border-b border-[var(--line)]">
      <div class="grid-backdrop" aria-hidden="true"></div>
      <div class="accent-glow hero-glow" aria-hidden="true"></div>

      <div
        class="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:gap-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-28"
      >
        <div class="min-w-0">
          <p class="eyebrow">
            <span class="slash-rule" aria-hidden="true"></span>
            {publicCopy($locale, "Centro de comando")}
          </p>

          <h1 class="display mt-6 text-5xl sm:text-7xl lg:text-8xl">
            {publicCopy($locale, "Toda a vida da")}
            {publicCopy($locale, "sua moto,")}
            <span class="text-[var(--accent)]"
              >{publicCopy($locale, "num só painel.")}</span
            >
          </h1>

          <p class="mt-8 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
            {publicCopy(
              $locale,
              "Hodômetro, custos, revisões, documentos e lembretes num só lugar. Pare de adivinhar quanto a sua moto custa — e saiba exatamente quando ela precisa de você.",
            )}
          </p>

          <div class="mt-10 flex flex-wrap items-center gap-3">
            <a
              class="button-accent px-7 py-3.5 text-base shadow-brand"
              href="/auth"
            >
              {publicCopy($locale, "Começar de graça")}
            </a>
            <a class="button-secondary px-7 py-3.5 text-base" href="/demo"
              >{publicCopy($locale, "Explorar demonstração")}</a
            >
          </div>

          <!-- Spec strip: reads like a service manual header. Wraps rather
               than clipping on narrow phones. -->
          <dl
            class="mt-14 flex max-w-lg flex-wrap gap-x-6 gap-y-5 border-t border-[var(--line)] pt-6"
          >
            <div
              class="min-w-[7.5rem] flex-1 border-l border-[var(--line)] pl-4"
            >
              <dt class="label-tech text-[var(--muted)]">
                {publicCopy($locale, "Registros")}
              </dt>
              <dd class="display mt-1 text-2xl sm:text-3xl">
                {publicCopy($locale, "Ilimitados")}
              </dd>
            </div>
            <div
              class="min-w-[7.5rem] flex-1 border-l border-[var(--line)] pl-4"
            >
              <dt class="label-tech text-[var(--muted)]">
                {publicCopy($locale, "Cartão")}
              </dt>
              <dd class="display mt-1 text-2xl sm:text-3xl">
                {publicCopy($locale, "Não pede")}
              </dd>
            </div>
            <div
              class="min-w-[7.5rem] flex-1 border-l border-[var(--line)] pl-4"
            >
              <dt class="label-tech text-[var(--muted)]">Offline</dt>
              <dd class="display mt-1 text-2xl sm:text-3xl">
                {publicCopy($locale, "Rascunhos")}
              </dd>
            </div>
          </dl>
        </div>

        <!-- ── INSTRUMENT CLUSTER ──────────────────────────────── -->
        <div class="hero-card min-w-0">
          <p class="label-tech mb-3 text-[var(--muted)]">
            {publicCopy($locale, "Painel ilustrativo")}
          </p>
          <div class="cluster panel p-5 sm:p-6">
            <div
              class="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4"
            >
              <p
                class="label-tech flex min-w-0 items-center gap-2 text-[var(--muted)]"
              >
                <Motorcycle size={16} class="shrink-0" />
                <span class="truncate">Honda CB 500F</span>
              </p>
              <p class="label-tech numeric shrink-0 text-[var(--muted)]">
                {formatDistance($locale, 32418)}
              </p>
            </div>

            <!-- Health score, the hero number. 87 is good, so it is green. -->
            <div class="grid grid-cols-[1.2fr_1fr] gap-5 pt-6">
              <div class="min-w-0">
                <p class="label-tech text-[var(--muted)]">
                  {publicCopy($locale, "Saúde da moto")}
                </p>
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    class="display numeric text-6xl leading-none sm:text-7xl"
                    >87</span
                  >
                  <StatusBadge tone="ok"
                    >{publicCopy($locale, "Bom")}</StatusBadge
                  >
                </div>
                <div
                  class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
                  aria-hidden="true"
                >
                  <div
                    class="gauge-fill h-full rounded-full bg-[var(--success)]"
                  ></div>
                </div>
              </div>

              <div class="min-w-0 border-l border-[var(--line)] pl-5">
                <p class="label-tech text-[var(--muted)]">
                  {publicCopy($locale, "Custo / km")}
                </p>
                <p class="display numeric mt-2 text-4xl leading-none">
                  {formatMoney($locale, 41)}
                </p>
                <p class="mt-3 text-xs text-[var(--muted)]">
                  {publicCopy($locale, "Média dos últimos 30 dias")}
                </p>
              </div>
            </div>

            <!-- Next reminder: due soon, so amber. Red is for overdue. -->
            <div
              class="mt-6 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="label-tech text-[var(--muted)]">
                  {publicCopy($locale, "Próximo alerta")}
                </p>
                <StatusBadge tone="due"
                  >{publicCopy($locale, "Em breve")}</StatusBadge
                >
              </div>
              <div class="mt-3 flex items-center gap-3">
                <OilCan size={24} class="shrink-0 text-[var(--warning)]" />
                <p class="display text-2xl">
                  {publicCopy($locale, "Troca de óleo em 340 km")}
                </p>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3">
              <div
                class="flex items-center gap-2.5 rounded border border-[var(--line)] px-3 py-2.5"
              >
                <VehicleTax size={16} class="shrink-0 text-success" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">IPVA 2026</p>
                  <p class="text-xs text-[var(--muted)]">
                    {publicCopy($locale, "Pago")}
                  </p>
                </div>
              </div>
              <div
                class="flex items-center gap-2.5 rounded border border-[var(--line)] px-3 py-2.5"
              >
                <Tire size={16} class="shrink-0 text-[var(--muted)]" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold">
                    {publicCopy($locale, "Pneus")}
                  </p>
                  <p class="text-xs text-[var(--muted)]">
                    {publicCopy($locale, "62% de vida")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── PRODUCT ───────────────────────────────────────────── -->
    <section class="border-b border-[var(--line)] px-4 py-20 sm:px-6 sm:py-24">
      <div class="mx-auto max-w-6xl">
        <div class="max-w-2xl">
          <p class="eyebrow">
            <span class="slash-rule" aria-hidden="true"></span>
            {publicCopy($locale, "O que tem dentro")}
          </p>
          <h2 class="display mt-5 text-5xl sm:text-6xl">
            {publicCopy($locale, "Tudo num só lugar")}
          </h2>
          <p class="mt-5 text-lg text-[var(--muted)]">
            {publicCopy(
              $locale,
              "Feito para reduzir custo e manter a moto pronta — no asfalto ou na pista.",
            )}
          </p>
        </div>

        <div class="mt-16 grid gap-20 sm:gap-24">
          {#each sections as section, i (section.view)}
            <article
              class="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
              aria-labelledby={`product-${section.view}`}
            >
              <div class="min-w-0 {i % 2 ? 'lg:order-2' : ''}">
                <p
                  class="label-tech inline-flex items-center gap-2 text-[var(--muted)]"
                >
                  <svelte:component
                    this={section.icon}
                    size={20}
                    aria-hidden="true"
                  />
                  {publicCopy($locale, section.label)}
                </p>
                <h3
                  id={`product-${section.view}`}
                  class="display mt-4 text-4xl sm:text-5xl"
                >
                  {publicCopy($locale, section.title)}
                </h3>
                <p
                  class="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted)]"
                >
                  {publicCopy($locale, section.body)}
                </p>
                <ul class="mt-6 grid max-w-md gap-3">
                  {#each section.points as point (point)}
                    <li class="flex items-start gap-3 text-sm">
                      <span class="tick" aria-hidden="true"></span>
                      <span>{publicCopy($locale, point)}</span>
                    </li>
                  {/each}
                </ul>
              </div>
              <div class="min-w-0 {i % 2 ? 'lg:order-1' : ''}">
                <ProductPreview initial={section.view} interactive={false} />
              </div>
            </article>
          {/each}
        </div>

        <!-- Professional use has no preview view of its own. -->
        <div
          class="mt-20 flex flex-col gap-5 rounded border border-[var(--line)] bg-[var(--panel)] p-6 sm:flex-row sm:items-center sm:p-8"
        >
          <Briefcase size={24} class="shrink-0 text-[var(--muted)]" />
          <div class="min-w-0 flex-1">
            <h3 class="display text-3xl">
              {publicCopy($locale, "Uso Profissional")}
            </h3>
            <p class="mt-2 text-[var(--muted)]">
              {publicCopy(
                $locale,
                "Turnos, receita e custo por dia. Para quem tira o sustento da moto e precisa saber o lucro real.",
              )}
            </p>
          </div>
          <a class="button-secondary shrink-0" href="/demo"
            >{publicCopy($locale, "Explorar demonstração")}</a
          >
        </div>
      </div>
    </section>

    <!-- ── PRICING ───────────────────────────────────────────── -->
    <section class="border-b border-[var(--line)] px-4 py-20 sm:px-6 sm:py-24">
      <div class="mx-auto max-w-6xl">
        <div class="max-w-2xl">
          <p class="eyebrow">
            <span class="slash-rule" aria-hidden="true"></span>
            {publicCopy($locale, "Planos")}
          </p>
          <h2 class="display mt-5 text-5xl sm:text-6xl">
            {publicCopy($locale, "Comece de graça")}
          </h2>
          <p class="mt-5 text-lg text-[var(--muted)]">
            {publicCopy(
              $locale,
              "Sem cartão, sem pegadinha. Suba de plano só quando precisar de mais.",
            )}
          </p>
        </div>

        <div class="mt-16 grid gap-6 md:grid-cols-2">
          <!-- Free -->
          <div class="panel flex flex-col p-6 sm:p-8">
            <h3 class="display text-3xl">Free</h3>
            <p class="mt-2 text-sm text-[var(--muted)]">
              {publicCopy($locale, "O essencial para acompanhar uma moto.")}
            </p>
            <div class="my-8">
              <p class="display numeric text-6xl">{formatMoney($locale, 0)}</p>
              <p class="mt-2 text-xs text-[var(--muted)]">
                {publicCopy($locale, "Para sempre")}
              </p>
            </div>
            <ul class="mb-8 flex-1 space-y-3.5">
              {#each freePlan as item, i (i)}
                <li class="flex items-start gap-3 text-sm text-[var(--muted)]">
                  <span class="tick" aria-hidden="true"></span>
                  <span>
                    {#each item as seg, j (j)}
                      {#if seg.b}<strong class="text-[var(--fg)]"
                          >{publicCopy($locale, seg.t)}</strong
                        >{:else}{publicCopy($locale, seg.t)}{/if}
                    {/each}
                  </span>
                </li>
              {/each}
            </ul>
            <a class="button-secondary w-full" href="/auth"
              >{publicCopy($locale, "Começar grátis")}</a
            >
          </div>

          <!-- Pro: inverted surface, so it out-weighs Free without red text.
               Its CTA is this screen's one red button. -->
          <div
            class="relative flex flex-col overflow-hidden rounded-panel bg-[var(--panel-invert)] p-6 text-paper shadow-lift sm:p-8"
          >
            <div class="corner-slashes" aria-hidden="true"></div>
            <div class="flex items-center justify-between gap-3">
              <h3 class="display text-3xl">Pro</h3>
              <span
                class="label-tech rounded-sm border border-white/25 px-2.5 py-1 text-paper"
              >
                {publicCopy($locale, "Recomendado")}
              </span>
            </div>
            <p class="mt-2 text-sm text-paper/70">
              {publicCopy(
                $locale,
                "Sem limites para quem usa a moto como ferramenta.",
              )}
            </p>
            <!-- Live from Dodo Payments. Falls back to a placeholder rather than a made-up
               number if Dodo Payments is unconfigured or unreachable. -->
            <div class="my-8">
              {#if data.pricing.monthly}
                <p class="display numeric text-6xl text-paper">
                  {planPrice(data.pricing.monthly)}
                </p>
                <p class="mt-2 text-xs text-paper/70">
                  {publicCopy($locale, "por mês")}
                  {#if data.pricing.yearly}{publicCopy($locale, "· ou")}
                    {planPrice(data.pricing.yearly)}
                    {publicCopy($locale, "por ano")}{/if}
                </p>
              {:else}
                <p class="display numeric text-6xl text-paper">R$&nbsp;—</p>
                <p class="mt-2 text-xs text-paper/70">
                  {publicCopy($locale, "Preço confirmado no checkout")}
                </p>
              {/if}
            </div>
            <ul class="mb-8 flex-1 space-y-3.5">
              {#each proPlan as item, i (i)}
                <li class="flex items-start gap-3 text-sm text-paper/80">
                  <span class="tick bg-paper/60" aria-hidden="true"></span>
                  <span>
                    {#each item as seg, j (j)}
                      {#if seg.b}<strong class="text-paper"
                          >{publicCopy($locale, seg.t)}</strong
                        >{:else}{publicCopy($locale, seg.t)}{/if}
                    {/each}
                  </span>
                </li>
              {/each}
            </ul>
            <a class="button-accent w-full" href="/precos"
              >{publicCopy($locale, "Assinar Pro")}</a
            >
          </div>
        </div>
      </div>
    </section>

    <!-- ── GUIDES ────────────────────────────────────────────── -->
    {#if data.articles.length}
      <section
        class="border-b border-[var(--line)] px-4 py-20 sm:px-6 sm:py-24"
      >
        <div class="mx-auto max-w-6xl">
          <div class="flex flex-wrap items-end justify-between gap-6">
            <div class="max-w-2xl">
              <p class="eyebrow">
                <span class="slash-rule" aria-hidden="true"></span>
                {publicCopy($locale, "Manual de garagem")}
              </p>
              <h2 class="display mt-5 text-5xl sm:text-6xl">
                {publicCopy($locale, "Aprenda a fazer você mesmo")}
              </h2>
              <p class="mt-5 text-lg text-[var(--muted)]">
                {publicCopy(
                  $locale,
                  "Guias com torque, intervalo e peça certa — de graça, sem precisar de conta.",
                )}
              </p>
            </div>
            <a class="button-secondary px-6 py-3" href="/blog"
              >{publicCopy($locale, "Ver todos os guias")}</a
            >
          </div>

          <div
            class="mt-16 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3"
          >
            {#each data.articles as article (article.slug)}
              <a
                class="feature focus-ring group flex flex-col bg-[var(--bg)] p-7"
                href={`/blog/${article.slug}`}
              >
                <h3
                  class="display text-2xl decoration-2 underline-offset-4 group-hover:underline"
                >
                  {article.title}
                </h3>
                <p
                  class="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]"
                >
                  {article.summary}
                </p>
                <span
                  class="label-tech mt-6 inline-flex items-center gap-2 text-[var(--fg)]"
                >
                  {publicCopy($locale, "Ler guia")}
                  <ArrowRight
                    size={16}
                    class="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </a>
            {/each}
          </div>
        </div>
      </section>
    {/if}

    <!-- ── CTA ───────────────────────────────────────────────── -->
    <section
      class="relative overflow-hidden bg-ink px-4 py-20 text-paper sm:px-6 sm:py-28"
    >
      <div class="cta-slashes" aria-hidden="true"></div>
      <div class="relative mx-auto max-w-3xl text-center">
        <h2 class="display text-5xl sm:text-7xl">
          {publicCopy($locale, "Pronto para acelerar?")}
        </h2>
        <p class="mx-auto mt-6 max-w-xl text-lg text-paper/70">
          {publicCopy(
            $locale,
            "Larga a planilha e o caderno. O Moto Track guarda a saúde, o custo e o histórico da sua companheira de estrada.",
          )}
        </p>
        <a
          class="button-accent mx-auto mt-10 px-8 py-4 text-base shadow-brand"
          href="/auth"
        >
          {publicCopy($locale, "Criar conta agora")}
          <ArrowRight size={20} />
        </a>
      </div>
    </section>
  </main>

  <PublicFooter />
</div>

<style>
  /* .slash-rule, .grid-backdrop, .accent-glow and .tick are global brand
     motifs — see app.css. Only page-specific pieces live here. */

  .hero-glow {
    top: -30%;
    right: -10%;
    width: 55%;
    height: 90%;
  }

  .corner-slashes,
  .cta-slashes {
    position: absolute;
    pointer-events: none;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }
  .corner-slashes {
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    opacity: 0.18;
  }
  .cta-slashes {
    top: 0;
    right: 0;
    width: 40%;
    height: 100%;
    opacity: 0.07;
  }

  .feature {
    transition: background-color 0.25s;
  }
  .feature:hover {
    background: var(--panel);
  }

  .cluster {
    box-shadow: 0 24px 60px -20px rgb(var(--shadow-color) / 0.25);
  }

  /* The product card is the only hero element that moves, and it starts from
     a visible resting state: translation only, never opacity 0. */
  .hero-card {
    animation: hero-card 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
  }
  @keyframes hero-card {
    from {
      transform: translateY(18px);
    }
    to {
      transform: none;
    }
  }

  .gauge-fill {
    width: 87%;
    animation: gauge 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
  }
  @keyframes gauge {
    from {
      width: 0%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-card,
    .gauge-fill {
      animation: none;
    }
  }
</style>
