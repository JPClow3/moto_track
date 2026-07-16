<script lang="ts">
  import { ArrowRight, Check, CircleDashed, Compass, Wrench } from "lucide-svelte";

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
          body: "Cadastro de motos, odômetro, perfil de uso e templates de fábrica com especificações pré-preenchidas.",
        },
        {
          title: "Abastecimento e consumo",
          body: "Litros, preço, tipo de combustível, custo por km real e alerta quando o consumo foge da faixa.",
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
          body: "Revisões, peças, planos por km ou data e fotos de antes e depois em cada serviço.",
        },
        {
          title: "Pneus",
          body: "Dianteiro e traseiro, desgaste percentual, calibragem e estimativa de quando trocar.",
        },
        {
          title: "Documentos",
          body: "CRLV, seguro, manual e notas fiscais anexados, com controle de validade.",
        },
        {
          title: "Lembretes e alertas",
          body: "Notificações por km rodado, data ou intervalo — incluindo push no celular.",
        },
        {
          title: "Relatórios e linha do tempo",
          body: "Resumo de custos, tendência de consumo, distribuição de gastos e histórico de eventos.",
        },
        {
          title: "Relatório de venda compartilhável",
          body: "Link público com o histórico completo da moto para mostrar ao comprador, com selo Pro.",
        },
        {
          title: "Uso profissional",
          body: "Turnos, receita e custo por dia para quem tira o sustento da moto.",
        },
        {
          title: "API v1 (leitura)",
          body: "Endpoints REST por token para abastecimentos, manutenções, pneus, lembretes, documentos e despesas.",
        },
        {
          title: "Instalável e offline",
          body: "PWA instalável no celular, com as telas já visitadas disponíveis sem conexão.",
        },
      ],
    },
    {
      status: "next",
      label: "Próximo",
      heading: "O que vem agora",
      blurb: "Definido e priorizado — é para onde vai o próximo esforço.",
      icon: Wrench,
      items: [
        {
          title: "Fila offline com sincronização em background",
          body: "Registrar abastecimento e odômetro sem sinal: o service worker guarda no dispositivo e envia quando a conexão volta.",
        },
        {
          title: "API v1 (escrita)",
          body: "POST e PATCH para criar e atualizar registros via token, além da leitura que já existe.",
        },
      ],
    },
    {
      status: "planned",
      label: "Planejado",
      heading: "Na fila",
      blurb: "Aceito no backlog, ainda sem posição definida.",
      icon: CircleDashed,
      items: [
        {
          title: "Geolocalização do posto",
          body: "Capturar a posição no registro de abastecimento e sugerir os postos que você mais usa.",
        },
        {
          title: "Visão multi-moto no painel",
          body: "Estado geral, odômetro e alertas de todas as motos ativas num quadro só.",
        },
        {
          title: "Alertas de anomalia no contexto",
          body: "Marcar o aviso direto na lista de abastecimentos quando consumo ou preço saírem da faixa.",
        },
      ],
    },
    {
      status: "exploring",
      label: "Em estudo",
      heading: "Ideias em avaliação",
      blurb: "Interessante no papel. Ainda sem compromisso de entrega.",
      icon: Compass,
      items: [
        {
          title: "Previsão de manutenção",
          body: "Usar o histórico de uso para antecipar quando cada serviço vai vencer, em vez de só contar km.",
        },
        {
          title: "Integração com marketplace de peças",
          body: "Ligar a peça do plano de manutenção a onde comprar, com preço comparado.",
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
      O que está pronto,<br /><span class="text-[var(--accent)]">e o que vem depois.</span>
    </h1>
    <p class="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
      Sem data prometida e sem funcionalidade fantasma. Esta página é o estado real do produto,
      atualizada à mão pela equipe.
    </p>

    <!-- Count strip — same idiom as the landing hero's spec strip. -->
    <dl
      class="count-strip mt-12 grid max-w-2xl grid-cols-2 gap-y-7 border-t border-[var(--line)] pt-6 sm:grid-cols-4"
    >
      {#each groups as group (group.status)}
        <div class="cell pr-5">
          <dt class="label-tech flex items-center gap-2 text-[var(--muted)]">
            <span class="h-1.5 w-1.5 rounded-full {dotClass[group.status]}" aria-hidden="true"></span>
            {group.label}
          </dt>
          <dd class="display numeric mt-1 text-4xl">{group.items.length}</dd>
        </div>
      {/each}
    </dl>
  </div>
</section>

<!-- ── GROUPS ──────────────────────────────────────────────── -->
{#each groups as group (group.status)}
  <section class="border-b border-[var(--line)] px-6 py-16">
    <div class="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[18rem_1fr] lg:gap-16">
      <!-- Sticky section identity, so the status stays visible while the list scrolls. -->
      <div class="lg:sticky lg:top-24 lg:self-start">
        <p class="eyebrow">
          <span class="slash-rule" aria-hidden="true"></span>
          {group.label}
        </p>
        <h2 class="display mt-4 text-4xl">{group.heading}</h2>
        <p class="mt-3 text-sm leading-relaxed text-[var(--muted)]">{group.blurb}</p>
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
                <span class="h-2 w-2 rounded-full {dotClass[group.status]}"></span>
              {/if}
            </span>
            <h3 class="display text-xl transition-colors group-hover:text-[var(--accent)]">
              {item.title}
            </h3>
            <p class="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
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
      O que entra nessa lista sai do que os motociclistas pedem. Crie sua conta e diga o que a sua
      moto precisa.
    </p>
    <div class="mt-9 flex flex-wrap items-center justify-center gap-3">
      <a class="button-accent px-7 py-3.5 text-base shadow-brand" href="/auth">
        Criar conta
        <ArrowRight class="h-4 w-4" />
      </a>
      <a class="button-secondary border-paper/20 bg-transparent px-7 py-3.5 text-base text-paper hover:border-[var(--accent)]" href="/blog">
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

  .cta-slashes {
    position: absolute;
    top: 0;
    right: 0;
    width: 40%;
    height: 100%;
    pointer-events: none;
    opacity: 0.07;
    background: repeating-linear-gradient(100deg, var(--accent) 0 6px, transparent 6px 16px);
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
