<script lang="ts">
  import { ArrowRight, Clock } from "lucide-svelte";
  import { locale } from "$lib/i18n/store";
  import { formatDate as formatDateFor } from "$lib/i18n";

  type Article = {
    title: string;
    slug: string;
    summary: string;
    published_at: string;
    reading_minutes: number;
  };

  export let data: { articles: Article[] };

  const formatDate = (value: string) =>
    formatDateFor($locale, value, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  // The newest guide gets the wide slot; the rest tile below it.
  $: [lead, ...rest] = data.articles;
</script>

<svelte:head>
  <title>Blog · Guias de manutenção de moto — Moto Track</title>
  <meta
    name="description"
    content="Guias práticos de manutenção de moto: troca de óleo, corrente, freios, pneus e consumo. Passo a passo com especificações reais por modelo."
  />
</svelte:head>

<!-- ── HEADER ──────────────────────────────────────────────── -->
<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow header-glow" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>
      Manual de garagem
    </p>
    <h1 class="display mt-5 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">
      Guias que evitam<br /><span class="text-[var(--accent)]"
        >oficina cara.</span
      >
    </h1>
    <p class="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
      Passo a passo, torque, intervalo e peça certa — escrito para quem faz a
      manutenção da própria moto.
    </p>
  </div>
</section>

<!-- ── ARTICLES ────────────────────────────────────────────── -->
<section class="px-6 py-16">
  <div class="mx-auto max-w-6xl">
    {#if lead}
      <!-- Lead article — spans the grid, sets the section's weight. -->
      <a
        class="lead panel group relative block overflow-hidden p-8 sm:p-10"
        href={`/blog/${lead.slug}`}
      >
        <div class="corner-slashes" aria-hidden="true"></div>
        <div class="relative max-w-3xl">
          <p class="eyebrow">
            <span class="slash-rule" aria-hidden="true"></span>
            Mais recente
          </p>
          <h2
            class="display mt-4 text-3xl transition-colors group-hover:text-[var(--accent)] sm:text-5xl"
          >
            {lead.title}
          </h2>
          <p
            class="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg"
          >
            {lead.summary}
          </p>
          <div class="mt-7 flex flex-wrap items-center gap-4">
            <span
              class="label-tech inline-flex items-center gap-2 text-[var(--accent)]"
            >
              Ler guia
              <ArrowRight
                class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
              />
            </span>
            <span class="label-tech text-[var(--muted)]"
              >{formatDate(lead.published_at)}</span
            >
            <span
              class="label-tech inline-flex items-center gap-1.5 text-[var(--muted)]"
            >
              <Clock class="h-3 w-3" />
              {lead.reading_minutes} min
            </span>
          </div>
        </div>
      </a>
    {/if}

    {#if rest.length}
      <div
        class="mt-px grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3"
      >
        {#each rest as article (article.slug)}
          <a
            class="card group flex flex-col bg-[var(--bg)] p-7"
            href={`/blog/${article.slug}`}
          >
            <div class="flex items-center gap-3">
              <span class="label-tech text-[var(--muted)]"
                >{formatDate(article.published_at)}</span
              >
              <span
                class="label-tech inline-flex items-center gap-1.5 text-[var(--muted)]"
              >
                <Clock class="h-3 w-3" />
                {article.reading_minutes} min
              </span>
            </div>
            <h3
              class="display mt-5 text-2xl transition-colors group-hover:text-[var(--accent)]"
            >
              {article.title}
            </h3>
            <p class="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
              {article.summary}
            </p>
            <span
              class="label-tech mt-6 inline-flex items-center gap-2 text-[var(--accent)]"
            >
              Ler
              <ArrowRight
                class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
              />
            </span>
          </a>
        {/each}
      </div>
    {/if}

    {#if !data.articles.length}
      <div class="panel p-12 text-center">
        <p class="display text-2xl">Nenhum guia publicado ainda</p>
        <p class="mt-3 text-[var(--muted)]">
          Os primeiros guias de manutenção chegam em breve.
        </p>
      </div>
    {/if}
  </div>
</section>

<style>
  .header-glow {
    top: -60%;
    right: -5%;
    width: 45%;
    height: 140%;
  }

  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 180px;
    height: 100px;
    pointer-events: none;
    opacity: 0.14;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }

  .lead {
    transition:
      border-color 0.25s,
      box-shadow 0.25s;
  }
  .lead:hover {
    border-color: var(--accent);
    box-shadow: 0 24px 60px -20px rgb(var(--shadow-color) / 0.18);
  }

  .card {
    transition: background-color 0.25s;
  }
  .card:hover {
    background: var(--panel);
  }
</style>
