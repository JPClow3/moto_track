<script lang="ts">
  import { onMount } from "svelte";
  import {
    ArrowRight,
    Check,
    CircleDashed,
    Compass,
    Wrench,
  } from "lucide-svelte";

  type Status = "done" | "next" | "planned" | "exploring";

  type Item = { title: string; body: string };

  type Group = {
    status: Status;
    label: string;
    heading: string;
    blurb: string;
    icon: typeof Check;
    items: Item[];
  };

  // Statuses are deliberately coarse. "next"/"planned" are statements of
  // intent, not delivery dates — the old roadmap promised dates and aged badly.
  const groups: Group[] = [
    {
      status: "done",
      label: "No ar",
      heading: "Já funciona",
      blurb: "Disponível hoje para todo mundo, free ou Pro.",
      icon: Check,
      items: [
        {
          title: "Garagem",
          body: "Cadastro de motos, odômetro atual e ficha básica de pneus e manual por moto.",
        },
        {
          title: "Abastecimento e consumo",
          body: "Litros, preço, tipo de combustível e custo por km calculado a partir do histórico.",
        },
        {
          title: "OCR de comprovante",
          body: "Fotografe o cupom do posto e o app extrai data, litros, total e preço por litro sozinho.",
        },
        {
          title: "Importação em lote via CSV",
          body: "Traga o histórico de abastecimentos de uma planilha sem redigitar registro por registro.",
        },
        {
          title: "Manutenção",
          body: "Revisões, peças, planos por km ou data e lembretes vinculados aos serviços.",
        },
        {
          title: "Pneus",
          body: "Histórico de instalação, desgaste informado, catálogo e registros de calibragem.",
        },
        {
          title: "Documentos",
          body: "CRLV, seguro, manual e notas fiscais com arquivo anexado e controle de validade.",
        },
        {
          title: "Despesas, IPVA e seguro",
          body: "Taxas anuais, apólices e sinistros no mesmo lugar do resto do custo da moto.",
        },
        {
          title: "Lembretes por km e data",
          body: "Vencimento por km rodado, data ou intervalo, com aviso por e-mail quando chega a hora.",
        },
        {
          title: "Relatórios e linha do tempo",
          body: "Linha do tempo filtrável e resumo de custos e consumo registrados.",
        },
        {
          title: "Relatório de venda compartilhável",
          body: "Link público, temporário e revogável com o histórico da moto para mostrar ao comprador.",
        },
        {
          title: "Uso profissional",
          body: "Turnos, receita, custos e rentabilidade calculada para quem trabalha com a moto.",
        },
        {
          title: "Exportação em CSV",
          body: "Qualquer módulo — abastecimento, manutenção, pneus, despesas — sai em planilha num clique.",
        },
        {
          title: "API v1",
          body: "Endpoints REST autenticados por sessão ou token pessoal, com leitura e escrita para abastecimentos, manutenções, pneus, lembretes, documentos e despesas.",
        },
        {
          title: "Guias e comunidade",
          body: "Artigos sobre manutenção e custo, com comentários e reações de quem já passou pelo problema.",
        },
        {
          title: "Assinatura Pro",
          body: "Checkout Pro, portal Stripe e atualização automática do status da assinatura.",
        },
        {
          title: "Conta e pedidos de dados",
          body: "Consulte o plano e solicite a exportação ou exclusão dos seus dados pela própria tela.",
        },
        {
          title: "Push no celular",
          body: "Lembretes também chegam como notificação do sistema quando o push está ativado na Conta.",
        },
      ],
    },
    {
      status: "next",
      label: "Próximo",
      heading: "O que vem agora",
      blurb: "Definido e priorizado — é para onde vai o próximo esforço.",
      icon: Wrench,
      items: [],
    },
    {
      status: "planned",
      label: "Planejado",
      heading: "Na fila",
      blurb: "Aceito no backlog, ainda sem posição definida.",
      icon: CircleDashed,
      items: [],
    },
    {
      status: "exploring",
      label: "Em estudo",
      heading: "Ideias em avaliação",
      blurb: "Interessante no papel. Ainda sem compromisso de entrega.",
      icon: Compass,
      items: [
        {
          title: "Comparação anônima por modelo",
          body: "Saber se o seu consumo e o seu custo de manutenção estão dentro do normal para quem tem a mesma moto.",
        },
      ],
    },
  ];

  const dotClass: Record<Status, string> = {
    done: "bg-success",
    next: "bg-[var(--accent)]",
    planned: "bg-[var(--muted)]",
    exploring: "bg-[var(--line)] ring-1 ring-[var(--muted)]",
  };

  const doneCount = groups.find((group) => group.status === "done")!.items
    .length;
  const totalCount = groups.reduce(
    (total, group) => total + group.items.length,
    0,
  );
  const targetPct = Math.round((doneCount / totalCount) * 100);

  // Drives the fill width and the numeral together, so they can never disagree.
  // Deliberately starts at 0 on the server too: resetting a server-rendered
  // targetPct back to 0 at hydration flashed the final number for ~180ms and
  // then snapped backwards. The honest figure is still in the static HTML —
  // the caption spells it out and aria-valuetext carries it — so a reader
  // without JS is told the truth in words even while the dial reads empty.
  let shownPct = 0;
  let gaugeEl: HTMLDivElement;

  onMount(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownPct = targetPct;
      return;
    }

    let frame = 0;
    let started = false;

    const run = () => {
      if (started) return;
      started = true;
      let start = 0;
      const duration = 1400;
      const tick = (now: number) => {
        // Seed the clock from the first frame's own timestamp. rAF reports when
        // the frame began, which can predate a performance.now() taken here —
        // that made t negative and briefly rendered "-2%".
        if (!start) start = now;
        const t = Math.min(Math.max((now - start) / duration, 0), 1);
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        shownPct = Math.round(targetPct * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // Hold at 0 until the gauge is actually on screen — the sweep is the whole
    // point, and it is wasted if it runs before anyone is looking.
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              if (!entries.some((entry) => entry.isIntersecting)) return;
              observer?.disconnect();
              run();
            },
            { threshold: 0.6 },
          )
        : null;
    observer?.observe(gaugeEl);

    // Never let a missing or misbehaving observer strand the gauge at 0% —
    // being stuck there misreports the roadmap. If it has not fired by now and
    // the gauge is on screen anyway, sweep regardless.
    const fallback = setTimeout(() => {
      if (started) return;
      const box = gaugeEl.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) {
        observer?.disconnect();
        run();
      }
    }, 500);

    return () => {
      observer?.disconnect();
      clearTimeout(fallback);
      cancelAnimationFrame(frame);
    };
  });
</script>

<svelte:head>
  <title>Roadmap · Moto Track</title>
  <meta
    name="description"
    content="O que já funciona no Moto Track, o que vem a seguir e o que ainda está em estudo. Roadmap público e atualizado pela equipe."
  />
</svelte:head>

<!-- ── HEADER ──────────────────────────────────────────────── -->
<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow header-glow" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>
      Transparência
    </p>
    <h1 class="display mt-5 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">
      O que está pronto,<br /><span class="text-[var(--accent)]"
        >e o que vem depois.</span
      >
    </h1>
    <p class="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
      Sem data prometida e sem funcionalidade fantasma. Esta página é o estado
      real do produto, atualizada à mão pela equipe.
    </p>

    <!-- Count strip — same idiom as the landing hero's spec strip. -->
    <dl
      class="count-strip mt-12 grid max-w-2xl grid-cols-2 gap-y-7 border-t border-[var(--line)] pt-6 sm:grid-cols-4"
    >
      {#each groups as group (group.status)}
        <div class="cell pr-5">
          <dt class="label-tech flex items-center gap-2 text-[var(--muted)]">
            <span
              class="h-1.5 w-1.5 rounded-full {dotClass[group.status]}"
              aria-hidden="true"
            ></span>
            {group.label}
          </dt>
          <dd class="display numeric mt-1 text-4xl">{group.items.length}</dd>
        </div>
      {/each}
    </dl>

    <!-- Overall completion, read as a fuel/service gauge rather than a web bar. -->
    <div class="gauge mt-10 max-w-2xl" bind:this={gaugeEl}>
      <div class="flex items-baseline justify-between gap-4">
        <p class="label-tech text-[var(--muted)]">Entregue</p>
        <p class="display numeric text-4xl tabular-nums" aria-hidden="true">
          {shownPct}%
        </p>
      </div>
      <div
        class="track mt-3"
        role="progressbar"
        aria-valuenow={targetPct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuetext="{targetPct}% do roadmap entregue"
        aria-label="Progresso geral do roadmap"
      >
        <div class="fill" style="width: {shownPct}%"></div>
        <div class="ticks" aria-hidden="true"></div>
      </div>
      <p class="mt-2.5 text-sm text-[var(--muted)]">
        {doneCount} dos {totalCount} itens deste roadmap já estão no ar.
      </p>
    </div>
  </div>
</section>

<!-- ── GROUPS ──────────────────────────────────────────────── -->
{#each groups as group (group.status)}
  <section class="border-b border-[var(--line)] px-6 py-16">
    <div
      class="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[18rem_1fr] lg:gap-16"
    >
      <!-- Sticky section identity, so the status stays visible while the list scrolls. -->
      <div class="lg:sticky lg:top-24 lg:self-start">
        <p class="eyebrow">
          <span class="slash-rule" aria-hidden="true"></span>
          {group.label}
        </p>
        <h2 class="display mt-4 text-4xl">{group.heading}</h2>
        <p class="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {group.blurb}
        </p>
        <p class="label-tech numeric mt-5 text-[var(--muted)]">
          {group.items.length}
          {group.items.length === 1 ? "item" : "itens"}
        </p>
      </div>

      <!-- Items hang off a single rail, like a service schedule. -->
      <ul class="rail relative space-y-px">
        {#each group.items as item (item.title)}
          <li class="item group relative bg-[var(--bg)] py-5 pl-10 pr-4">
            <span
              class="marker absolute left-0 top-6 grid h-6 w-6 place-items-center rounded-full border border-[var(--line)] bg-[var(--bg)]"
              aria-hidden="true"
            >
              {#if group.status === "done"}
                <Check class="h-3.5 w-3.5 text-success" />
              {:else}
                <span class="h-2 w-2 rounded-full {dotClass[group.status]}"
                ></span>
              {/if}
            </span>
            <h3
              class="display text-xl transition-colors group-hover:text-[var(--accent)]"
            >
              {item.title}
            </h3>
            <p class="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
              {item.body}
            </p>
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/each}

<!-- ── CTA ─────────────────────────────────────────────────── -->
<section class="relative overflow-hidden bg-ink px-6 py-24 text-paper">
  <div class="cta-slashes" aria-hidden="true"></div>
  <div class="relative mx-auto max-w-3xl text-center">
    <h2 class="display text-5xl sm:text-6xl">Faltou alguma coisa?</h2>
    <p class="mx-auto mt-5 max-w-xl text-lg text-paper/60">
      O que entra nessa lista sai do que os motociclistas pedem. Crie sua conta
      e diga o que a sua moto precisa.
    </p>
    <div class="mt-9 flex flex-wrap items-center justify-center gap-3">
      <a class="button-accent px-7 py-3.5 text-base shadow-brand" href="/auth">
        Criar conta
        <ArrowRight class="h-4 w-4" />
      </a>
      <a
        class="button-secondary border-paper/20 bg-transparent px-7 py-3.5 text-base text-paper hover:border-[var(--accent)]"
        href="/blog"
      >
        Ler os guias
      </a>
    </div>
  </div>
</section>

<style>
  .header-glow {
    top: -60%;
    right: -5%;
    width: 45%;
    height: 140%;
  }

  /* Divider between counts. Driven by nth-child rather than the loop index:
     the strip is 2-up on mobile and 4-up from `sm`, so "not the first cell"
     and "not the first cell *in its row*" are different rules — the index
     version drew a stray border down the left edge of the second row. */
  .count-strip .cell {
    padding-left: 1.25rem;
    border-left: 1px solid var(--line);
  }
  .count-strip .cell:nth-child(odd) {
    padding-left: 0;
    border-left: 0;
  }
  @media (min-width: 640px) {
    .count-strip .cell:nth-child(odd) {
      padding-left: 1.25rem;
      border-left: 1px solid var(--line);
    }
    .count-strip .cell:first-child {
      padding-left: 0;
      border-left: 0;
    }
  }

  /* Segmented gauge. The ticks are painted in --bg *over* both the fill and the
     empty track, so they read as physical gaps in a dial instead of stripes. */
  .gauge .track {
    position: relative;
    height: 0.75rem;
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--panel);
  }
  .gauge .fill {
    height: 100%;
    background: var(--accent);
    box-shadow: 0 0 20px -2px var(--accent-ring);
  }
  .gauge .ticks {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      90deg,
      transparent 0 calc(5% - 2px),
      var(--bg) calc(5% - 2px) 5%
    );
  }

  .cta-slashes {
    position: absolute;
    top: 0;
    right: 0;
    width: 40%;
    height: 100%;
    pointer-events: none;
    opacity: 0.07;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }

  /* The rail itself: one continuous line the markers sit on. */
  .rail::before {
    content: "";
    position: absolute;
    left: 11.5px;
    top: 1.5rem;
    bottom: 1.5rem;
    width: 1px;
    background: var(--line);
  }

  .item {
    transition: background-color 0.25s;
  }
  .item:hover {
    background: var(--panel);
  }
  .item:hover .marker {
    border-color: var(--accent);
  }
</style>
