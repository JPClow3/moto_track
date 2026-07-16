<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import { ArrowLeft, ArrowRight, Clock, MessageSquare } from "lucide-svelte";
  import Markdown from "$components/Markdown.svelte";

  export let data;
  export let form;

  const dateFormat = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const reactionEmojis = ["👍", "🏍️", "💡"];

  $: article = data.article;
  $: publishedLabel = dateFormat.format(new Date(article.published_at));
  // Derived as data rather than a reactive function: the counts only change
  // when data.reactions does.
  $: reactionCounts = reactionEmojis.map(
    (emoji) =>
      data.reactions.filter((reaction) => reaction.emoji === emoji).length,
  );
  $: canonical = new URL(`/blog/${article.slug}`, $page.url.origin).href;
  $: metaDescription = article.meta_description || article.summary;
</script>

<svelte:head>
  <title>{article.title} · Moto Track</title>
  <meta name="description" content={metaDescription} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content={article.title} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content={canonical} />
  <meta property="article:published_time" content={article.published_at} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<!-- ── ARTICLE HEADER ──────────────────────────────────────── -->
<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow header-glow" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-3xl px-6 py-14 sm:py-16">
    <a
      class="label-tech inline-flex items-center gap-2 text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
      href="/blog"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
      Todos os guias
    </a>

    <h1 class="display mt-7 text-4xl sm:text-5xl lg:text-6xl">{article.title}</h1>

    <p class="mt-6 text-lg leading-relaxed text-[var(--muted)]">{article.summary}</p>

    <!-- Byline strip, in the spec-strip idiom used on the landing hero. -->
    <div
      class="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line)] pt-5"
    >
      <span class="label-tech text-[var(--muted)]">{publishedLabel}</span>
      <span class="label-tech inline-flex items-center gap-1.5 text-[var(--muted)]">
        <Clock class="h-3 w-3" />
        {article.reading_minutes} min de leitura
      </span>
      <span class="label-tech inline-flex items-center gap-1.5 text-[var(--muted)]">
        <MessageSquare class="h-3 w-3" />
        {data.comments.length}
        {data.comments.length === 1 ? "comentário" : "comentários"}
      </span>
    </div>
  </div>
</section>

<!-- ── BODY ────────────────────────────────────────────────── -->
<article class="mx-auto max-w-3xl px-6 py-12">
  <Markdown source={article.body} />
</article>

<!-- ── REACTIONS ───────────────────────────────────────────── -->
<section class="mx-auto max-w-3xl px-6">
  <div class="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-8">
    <p class="label-tech text-[var(--muted)]">Esse guia ajudou?</p>
    <div class="flex flex-wrap gap-2">
      {#each reactionEmojis as emoji, i (emoji)}
        <form method="POST" action="?/react" use:enhance>
          <input type="hidden" name="emoji" value={emoji} />
          <button class="button-secondary numeric px-3.5" type="submit">
            <span aria-hidden="true">{emoji}</span>
            {reactionCounts[i]}
          </button>
        </form>
      {/each}
    </div>
  </div>
</section>

<!-- ── CTA ─────────────────────────────────────────────────── -->
<section class="mx-auto max-w-3xl px-6 pt-12">
  <div class="relative overflow-hidden rounded-panel bg-[var(--panel-invert)] p-8 text-paper">
    <div class="corner-slashes" aria-hidden="true"></div>
    <div class="relative sm:flex sm:items-center sm:justify-between sm:gap-8">
      <div>
        <h2 class="display text-3xl">Registre essa manutenção</h2>
        <p class="mt-2.5 max-w-md text-sm text-paper/60">
          Anote a troca no Moto Track e receba o lembrete do próximo intervalo automaticamente —
          por km rodado ou por data.
        </p>
      </div>
      <a class="button-accent mt-6 shrink-0 px-6 py-3 sm:mt-0" href="/auth">
        Começar de graça
        <ArrowRight class="h-4 w-4" />
      </a>
    </div>
  </div>
</section>

<!-- ── COMMENTS ────────────────────────────────────────────── -->
<section class="mx-auto max-w-3xl px-6 py-12">
  <p class="eyebrow">
    <span class="slash-rule" aria-hidden="true"></span>
    Comentários
  </p>
  <h2 class="display mt-4 text-3xl">Experiências da garagem</h2>

  {#if form?.message}
    <p class="mt-5 rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
      {form.message}
    </p>
  {/if}

  <form method="POST" action="?/comment" use:enhance class="panel mt-6 grid gap-3 p-5">
    <label class="label-tech text-[var(--muted)]" for="comment-body">Seu comentário</label>
    <textarea
      id="comment-body"
      class="field min-h-24"
      name="body"
      placeholder="Compartilhe sua experiência com esse serviço"
    ></textarea>
    <button class="button-primary w-fit" type="submit">Comentar</button>
  </form>

  <div class="mt-6 space-y-3">
    {#each data.comments as comment (comment.id)}
      <article class="panel p-5">
        <div class="flex items-center gap-3">
          <span
            class="display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-sm text-[var(--accent)]"
            aria-hidden="true"
          >
            {comment.author.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p class="text-sm font-semibold">{comment.author}</p>
            <p class="label-tech text-[var(--muted)]">
              {new Date(comment.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
        <p class="mt-4 leading-relaxed text-[var(--muted)]">{comment.body}</p>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">
        Nenhum comentário ainda. Seja o primeiro a contar como foi na sua moto.
      </p>
    {/each}
  </div>
</section>

<!-- ── RELATED ─────────────────────────────────────────────── -->
{#if data.related.length}
  <section class="border-t border-[var(--line)] px-6 py-14">
    <div class="mx-auto max-w-6xl">
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>
        Continue lendo
      </p>
      <h2 class="display mt-4 text-3xl">Outros guias</h2>
      <div class="mt-8 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
        {#each data.related as item (item.slug)}
          <a class="card group flex flex-col bg-[var(--bg)] p-6" href={`/blog/${item.slug}`}>
            <h3 class="display text-xl transition-colors group-hover:text-[var(--accent)]">
              {item.title}
            </h3>
            <p class="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">
              {item.summary}
            </p>
            <span class="label-tech mt-5 inline-flex items-center gap-2 text-[var(--accent)]">
              Ler
              <ArrowRight class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </a>
        {/each}
      </div>
    </div>
  </section>
{/if}

<style>
  .header-glow {
    top: -70%;
    right: 0%;
    width: 50%;
    height: 150%;
  }

  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    pointer-events: none;
    opacity: 0.18;
    background: repeating-linear-gradient(100deg, var(--accent) 0 6px, transparent 6px 16px);
  }

  .card {
    transition: background-color 0.25s;
  }
  .card:hover {
    background: var(--panel);
  }
</style>
