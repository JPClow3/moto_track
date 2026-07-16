<script lang="ts">
  import { Wrench, Droplet, Bell, Briefcase, Gauge, Shield, ArrowRight } from "lucide-svelte";
  import PublicHeader from "$components/PublicHeader.svelte";
  import PublicFooter from "$components/PublicFooter.svelte";
  import type { ProPricing } from "$types/billing";

  type Article = { title: string; slug: string; summary: string };

  export let data: { pricing: ProPricing; articles: Article[] };

  const features = [
    {
      n: "01",
      icon: Droplet,
      title: "Custos & Combustível",
      body: "Acompanhe cada abastecimento, visualize seu custo por km real e anexe recibos sem planilha nenhuma.",
    },
    {
      n: "02",
      icon: Wrench,
      title: "Manutenção",
      body: "Registre peças, serviços e desgaste dos pneus. Um histórico completo que vira valor na hora da revenda.",
    },
    {
      n: "03",
      icon: Bell,
      title: "Lembretes",
      body: "Nunca mais perca uma troca de óleo ou o IPVA. Alertas por quilometragem rodada ou por data.",
    },
    {
      n: "04",
      icon: Briefcase,
      title: "Uso Profissional",
      body: "Turnos, receita e custo por dia. Para quem tira o sustento da moto e precisa saber o lucro real.",
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
  <title>Moto Track — Centro de Comando da sua Moto</title>
  <meta
    name="description"
    content="Controle de combustível, manutenção, pneus, documentos e lembretes para a sua moto."
  />
</svelte:head>

<div class="landing">
  <!-- ── NAV ───────────────────────────────────────────────── -->
  <PublicHeader />

  <!-- ── HERO ──────────────────────────────────────────────── -->
  <section class="relative overflow-hidden border-b border-[var(--line)]">
    <div class="grid-backdrop" aria-hidden="true"></div>
    <div class="accent-glow hero-glow" aria-hidden="true"></div>

    <div
      class="relative mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-28"
    >
      <div>
        <p class="reveal eyebrow" style="--d:0ms">
          <span class="slash-rule" aria-hidden="true"></span>
          Centro de comando
        </p>

        <h1 class="reveal display mt-6 text-6xl sm:text-7xl lg:text-8xl" style="--d:60ms">
          Toda a vida da<br />sua moto,<br />
          <span class="text-[var(--accent)]">num só painel.</span>
        </h1>

        <p class="reveal mt-8 max-w-lg text-lg leading-relaxed text-[var(--muted)]" style="--d:120ms">
          Hodômetro, custos, revisões, documentos e lembretes num só lugar. Pare de adivinhar quanto
          a sua moto custa — e saiba exatamente quando ela precisa de você.
        </p>

        <div class="reveal mt-10 flex flex-wrap items-center gap-3" style="--d:180ms">
          <a class="button-accent px-7 py-3.5 text-base shadow-brand" href="/auth">
            Começar de graça
          </a>
          <a class="button-secondary px-7 py-3.5 text-base" href="/precos">Ver planos</a>
        </div>

        <!-- Spec strip — reads like a service manual header. -->
        <dl
          class="reveal mt-14 grid max-w-lg grid-cols-3 border-t border-[var(--line)] pt-6"
          style="--d:240ms"
        >
          <div>
            <dt class="label-tech text-[var(--muted)]">Registros</dt>
            <dd class="display numeric mt-1 text-3xl">Ilimitados</dd>
          </div>
          <div class="border-l border-[var(--line)] pl-5">
            <dt class="label-tech text-[var(--muted)]">Cartão</dt>
            <dd class="display numeric mt-1 text-3xl">Não pede</dd>
          </div>
          <div class="border-l border-[var(--line)] pl-5">
            <dt class="label-tech text-[var(--muted)]">Offline</dt>
            <dd class="display numeric mt-1 text-3xl">Funciona</dd>
          </div>
        </dl>
      </div>

      <!-- ── INSTRUMENT CLUSTER ──────────────────────────────── -->
      <div class="reveal" style="--d:300ms">
        <div class="cluster panel p-6">
          <div class="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <p class="label-tech text-[var(--muted)]">Honda CB 500F</p>
            <p class="label-tech numeric text-[var(--muted)]">32.418 km</p>
          </div>

          <!-- Health score, the hero number. -->
          <div class="grid grid-cols-[1.2fr_1fr] gap-5 pt-6">
            <div>
              <p class="label-tech text-[var(--muted)]">Saúde da moto</p>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="display numeric text-7xl leading-none">87</span>
                <span class="label-tech text-success">Bom</span>
              </div>
              <!-- Gauge track -->
              <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                <div class="gauge-fill h-full rounded-full bg-[var(--accent)]"></div>
              </div>
            </div>

            <div class="border-l border-[var(--line)] pl-5">
              <p class="label-tech text-[var(--muted)]">Custo / km</p>
              <p class="display numeric mt-2 text-4xl leading-none">R$0,41</p>
              <p class="mt-3 text-xs text-[var(--muted)]">Média dos últimos 30 dias</p>
            </div>
          </div>

          <!-- Next alert — the one dark surface, like a dash readout. -->
          <div class="mt-6 overflow-hidden rounded bg-ink p-5 text-paper">
            <div class="flex items-center gap-2">
              <span class="slash-rule slash-rule--sm text-[var(--accent)]" aria-hidden="true"></span>
              <p class="label-tech text-paper/50">Próximo alerta</p>
            </div>
            <div class="mt-3 flex items-center gap-3">
              <Bell class="h-5 w-5 shrink-0 text-[var(--accent)]" />
              <p class="display text-2xl">Troca de óleo em 340 km</p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-4">
            <div class="flex items-center gap-2.5 rounded border border-[var(--line)] px-3 py-2.5">
              <Shield class="h-4 w-4 shrink-0 text-success" />
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">IPVA 2026</p>
                <p class="text-xs text-[var(--muted)]">Pago</p>
              </div>
            </div>
            <div class="flex items-center gap-2.5 rounded border border-[var(--line)] px-3 py-2.5">
              <Gauge class="h-4 w-4 shrink-0 text-[var(--muted)]" />
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">Pneus</p>
                <p class="text-xs text-[var(--muted)]">62% de vida</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FEATURES ──────────────────────────────────────────── -->
  <section class="border-b border-[var(--line)] px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <div class="max-w-2xl">
        <p class="eyebrow">
          <span class="slash-rule" aria-hidden="true"></span>
          O que tem dentro
        </p>
        <h2 class="display mt-5 text-5xl sm:text-6xl">Tudo num só lugar</h2>
        <p class="mt-5 text-lg text-[var(--muted)]">
          Feito para reduzir custo e manter a moto pronta — no asfalto ou na pista.
        </p>
      </div>

      <div class="mt-16 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
        {#each features as f (f.n)}
          <article class="feature group bg-[var(--bg)] p-7">
            <div class="flex items-start justify-between">
              <svelte:component this={f.icon} class="h-6 w-6 text-[var(--accent)]" />
              <span class="display numeric text-3xl text-[var(--line)] transition-colors group-hover:text-[var(--accent)]">
                {f.n}
              </span>
            </div>
            <h3 class="display mt-8 text-2xl">{f.title}</h3>
            <p class="mt-3 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── PRICING ───────────────────────────────────────────── -->
  <section class="border-b border-[var(--line)] px-6 py-24">
    <div class="mx-auto max-w-6xl">
      <div class="max-w-2xl">
        <p class="eyebrow">
          <span class="slash-rule" aria-hidden="true"></span>
          Planos
        </p>
        <h2 class="display mt-5 text-5xl sm:text-6xl">Comece de graça</h2>
        <p class="mt-5 text-lg text-[var(--muted)]">
          Sem cartão, sem pegadinha. Suba de plano só quando precisar de mais.
        </p>
      </div>

      <div class="mt-16 grid gap-6 md:grid-cols-2">
        <!-- Free -->
        <div class="panel flex flex-col p-8">
          <h3 class="display text-3xl">Free</h3>
          <p class="mt-2 text-sm text-[var(--muted)]">O essencial para acompanhar uma moto.</p>
          <div class="my-8">
            <p class="display numeric text-6xl">R$0</p>
            <p class="mt-2 text-xs text-[var(--muted)]">Para sempre</p>
          </div>
          <ul class="mb-8 flex-1 space-y-3.5">
            {#each freePlan as item, i (i)}
              <li class="flex items-start gap-3 text-sm text-[var(--muted)]">
                <span class="tick" aria-hidden="true"></span>
                <span>
                  {#each item as seg, j (j)}
                    {#if seg.b}<strong class="text-[var(--fg)]">{seg.t}</strong>{:else}{seg.t}{/if}
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
          <a class="button-secondary w-full" href="/auth">Começar grátis</a>
        </div>

        <!-- Pro — inverted surface, so it out-weighs Free without shouting red. -->
        <div
          class="relative flex flex-col overflow-hidden rounded-panel bg-[var(--panel-invert)] p-8 text-paper shadow-lift"
        >
          <div class="corner-slashes" aria-hidden="true"></div>
          <div class="flex items-center justify-between">
            <h3 class="display text-3xl">Pro</h3>
            <span class="label-tech rounded-sm bg-[var(--accent-solid)] px-2.5 py-1 text-white">
              Recomendado
            </span>
          </div>
          <p class="mt-2 text-sm text-paper/60">
            Sem limites para quem usa a moto como ferramenta.
          </p>
          <!-- Live from Stripe. Falls back to a placeholder rather than a made-up
               number if Stripe is unconfigured or unreachable. -->
          <div class="my-8">
            {#if data.pricing.monthly}
              <p class="display numeric text-6xl text-[var(--accent)]">
                {data.pricing.monthly.formatted}
              </p>
              <p class="mt-2 text-xs text-paper/50">
                por mês
                {#if data.pricing.yearly}&middot; ou {data.pricing.yearly.formatted} por ano{/if}
              </p>
            {:else}
              <p class="display numeric text-6xl text-[var(--accent)]">R$&nbsp;—</p>
              <p class="mt-2 text-xs text-paper/50">Preço confirmado no checkout</p>
            {/if}
          </div>
          <ul class="mb-8 flex-1 space-y-3.5">
            {#each proPlan as item, i (i)}
              <li class="flex items-start gap-3 text-sm text-paper/80">
                <span class="tick tick--accent" aria-hidden="true"></span>
                <span>
                  {#each item as seg, j (j)}
                    {#if seg.b}<strong class="text-paper">{seg.t}</strong>{:else}{seg.t}{/if}
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
          <a class="button-accent w-full" href="/precos">Assinar Pro</a>
        </div>
      </div>
    </div>
  </section>

  <!-- ── GUIDES ────────────────────────────────────────────── -->
  {#if data.articles.length}
    <section class="border-b border-[var(--line)] px-6 py-24">
      <div class="mx-auto max-w-6xl">
        <div class="flex flex-wrap items-end justify-between gap-6">
          <div class="max-w-2xl">
            <p class="eyebrow">
              <span class="slash-rule" aria-hidden="true"></span>
              Manual de garagem
            </p>
            <h2 class="display mt-5 text-5xl sm:text-6xl">Aprenda a fazer você mesmo</h2>
            <p class="mt-5 text-lg text-[var(--muted)]">
              Guias com torque, intervalo e peça certa — de graça, sem precisar de conta.
            </p>
          </div>
          <a class="button-secondary px-6 py-3" href="/blog">Ver todos os guias</a>
        </div>

        <div class="mt-16 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
          {#each data.articles as article (article.slug)}
            <a class="feature group flex flex-col bg-[var(--bg)] p-7" href={`/blog/${article.slug}`}>
              <h3 class="display text-2xl transition-colors group-hover:text-[var(--accent)]">
                {article.title}
              </h3>
              <p class="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                {article.summary}
              </p>
              <span class="label-tech mt-6 inline-flex items-center gap-2 text-[var(--accent)]">
                Ler guia
                <ArrowRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <!-- ── CTA ───────────────────────────────────────────────── -->
  <section class="relative overflow-hidden bg-ink px-6 py-28 text-paper">
    <div class="cta-slashes" aria-hidden="true"></div>
    <div class="relative mx-auto max-w-3xl text-center">
      <h2 class="display text-6xl sm:text-7xl">Pronto para acelerar?</h2>
      <p class="mx-auto mt-6 max-w-xl text-lg text-paper/60">
        Larga a planilha e o caderno. O Moto Track guarda a saúde, o custo e o histórico da sua
        companheira de estrada.
      </p>
      <a class="button-accent mx-auto mt-10 px-8 py-4 text-base shadow-brand" href="/auth">
        Criar conta agora
        <ArrowRight class="h-4 w-4" />
      </a>
    </div>
  </section>

  <!-- ── FOOTER ────────────────────────────────────────────── -->
  <PublicFooter />
</div>

<style>
  /* .slash-rule, .nav-link, .grid-backdrop, .accent-glow and .tick are global
     brand motifs — see app.css. Only page-specific pieces live here. */

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

  /* Load-in: CSS-driven so content is in the HTML for crawlers and LCP. */
  .reveal {
    animation: reveal 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--d, 0ms);
  }
  @keyframes reveal {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .gauge-fill {
    width: 87%;
    animation: gauge 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.5s both;
  }
  @keyframes gauge {
    from {
      width: 0%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal,
    .gauge-fill {
      animation: none;
    }
  }
</style>
