<script lang="ts">
  import { ArrowRight, FileText, Mail, Printer, Scale } from "lucide-svelte";

  const sections = [
    {
      id: "aceitacao",
      title: "Aceitação dos termos",
      paragraphs: [
        "Ao criar uma conta ou usar o Moto Track, você concorda com estes Termos de Uso e com a nossa Política de Privacidade. Se você não concordar com algum ponto, não utilize o serviço.",
        "Este é um documento operacional genérico e deve passar por revisão jurídica antes de um lançamento comercial definitivo.",
      ],
    },
    {
      id: "servico",
      title: "Descrição do serviço",
      paragraphs: [
        "O Moto Track é uma ferramenta para organizar o histórico de motocicletas: abastecimentos, manutenções, documentos, despesas, lembretes e relatórios. Parte dos recursos está disponível no plano gratuito e parte no plano Pro, mediante assinatura.",
        "Podemos alterar, adicionar ou remover recursos ao longo do tempo para manter o produto estável, seguro e sustentável.",
      ],
    },
    {
      id: "conta",
      title: "Contas e responsabilidades do usuário",
      paragraphs: [
        "Você é responsável por manter suas credenciais em sigilo e por todas as atividades realizadas na sua conta. Informe dados verdadeiros ao se cadastrar e mantenha seu e-mail atualizado para receber comunicações relevantes.",
        "Avise-nos imediatamente se suspeitar de acesso não autorizado à sua conta.",
      ],
    },
    {
      id: "uso-aceitavel",
      title: "Uso aceitável",
      paragraphs: [
        "Não é permitido usar o Moto Track para fins ilícitos, para violar direitos de terceiros, para tentar acessar dados de outras contas, para interferir na operação do serviço ou para realizar engenharia reversa além do permitido em lei.",
        "Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos ou que representem risco de segurança para o serviço ou para outros usuários.",
      ],
    },
    {
      id: "assinatura",
      title: "Assinatura Pro e cobrança",
      paragraphs: [
        "O plano Pro é cobrado de forma recorrente pelo processador de pagamentos utilizado pelo Moto Track. Os valores, a periodicidade e os métodos de pagamento aceitos são exibidos antes da confirmação da assinatura.",
        "Você pode cancelar a assinatura a qualquer momento pela área Conta; o acesso Pro permanece ativo até o fim do período já pago, sem reembolso proporcional, salvo quando exigido por lei.",
      ],
    },
    {
      id: "propriedade",
      title: "Propriedade intelectual",
      paragraphs: [
        "O Moto Track, sua marca, interface e código são de titularidade de seus desenvolvedores. Os dados que você cadastra sobre suas motocicletas continuam sendo seus; usamos esses dados apenas para fornecer o serviço, conforme a Política de Privacidade.",
      ],
    },
    {
      id: "limitacoes",
      title: "Limitações e responsabilidade",
      paragraphs: [
        "O Moto Track é fornecido 'como está', sem garantia de disponibilidade ininterrupta ou de ausência total de falhas. Registros como odômetro, consumo, custos e previsões de manutenção são estimativas e não substituem o manual do fabricante ou a avaliação de um profissional qualificado.",
        "Na máxima medida permitida por lei, não respondemos por danos indiretos, lucros cessantes ou perda de dados decorrentes do uso ou da impossibilidade de uso do serviço. Mantenha backups próprios de informações críticas quando possível.",
      ],
    },
    {
      id: "rescisao",
      title: "Encerramento da conta",
      paragraphs: [
        "Você pode encerrar sua conta a qualquer momento pela área Conta, que também permite solicitar exportação dos seus dados antes da exclusão. Podemos suspender ou encerrar contas em caso de violação destes termos, fraude ou inatividade prolongada, mediante aviso quando exigido por lei.",
      ],
    },
    {
      id: "alteracoes",
      title: "Alterações destes termos",
      paragraphs: [
        "Podemos atualizar estes termos para refletir mudanças no serviço ou na legislação aplicável. Quando a alteração for relevante, atualizaremos a data nesta página e poderemos avisar pelo serviço ou por e-mail.",
      ],
    },
    {
      id: "contato",
      title: "Contato",
      paragraphs: [
        "Para dúvidas sobre estes Termos de Uso, escreva para privacidade@moto-track.app.",
      ],
    },
  ];
</script>

<svelte:head>
  <title>Termos de Uso · Moto Track</title>
  <meta
    name="description"
    content="Termos de Uso do Moto Track: assinatura, responsabilidades e limitações do serviço."
  />
</svelte:head>

<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow legal-glow" aria-hidden="true"></div>
  <div class="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span> Termos e condições
    </p>
    <div class="mt-5 flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 class="display text-5xl sm:text-6xl lg:text-7xl">
          Regras claras,<br /><span class="text-[var(--accent)]"
            >sem letra miúda.</span
          >
        </h1>
        <p class="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Como funciona o uso do Moto Track, o plano Pro e o que esperar do
          serviço.
        </p>
      </div>
      <button
        class="button-secondary gap-2"
        type="button"
        onclick={() => window.print()}
        ><Printer class="h-4 w-4" /> Imprimir</button
      >
    </div>
    <p
      class="label-tech mt-10 border-t border-[var(--line)] pt-5 text-[var(--muted)]"
    >
      Última atualização: 16 de julho de 2026
    </p>
  </div>
</section>

<section
  class="mx-auto grid max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-20"
>
  <aside class="lg:sticky lg:top-24 lg:self-start">
    <p class="label-tech text-[var(--muted)]">Neste documento</p>
    <nav
      class="mt-4 border-l border-[var(--line)]"
      aria-label="Seções dos termos"
    >
      {#each sections as section, index (section.id)}
        <a
          class="legal-nav-link block px-4 py-2 text-sm text-[var(--muted)]"
          href={`#${section.id}`}
          ><span class="label-tech mr-2 text-[var(--accent)]">0{index + 1}</span
          >{section.title}</a
        >
      {/each}
    </nav>
  </aside>

  <article class="max-w-3xl">
    <div
      class="mb-12 grid gap-4 border-b border-[var(--line)] pb-6 sm:grid-cols-2"
    >
      <div class="flex gap-3">
        <FileText class="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <p class="text-sm leading-relaxed text-[var(--muted)]">
          Documento genérico, revisado antes de qualquer lançamento comercial.
        </p>
      </div>
      <div class="flex gap-3">
        <Scale class="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <p class="text-sm leading-relaxed text-[var(--muted)]">
          Cancele a assinatura Pro quando quiser, pela área Conta.
        </p>
      </div>
    </div>
    {#each sections as section, index (section.id)}
      <section
        id={section.id}
        class="scroll-mt-28 border-b border-[var(--line)] py-9 first:pt-0"
      >
        <p class="label-tech text-[var(--accent)]">0{index + 1}</p>
        <h2 class="display mt-3 text-3xl sm:text-4xl">{section.title}</h2>
        {#each section.paragraphs as paragraph}<p
            class="mt-4 leading-relaxed text-[var(--muted)]"
          >
            {paragraph}
          </p>{/each}
      </section>
    {/each}
    <div
      class="relative mt-10 overflow-hidden rounded-panel bg-[var(--panel-invert)] p-7 text-paper"
    >
      <div class="corner-slashes" aria-hidden="true"></div>
      <div class="relative flex gap-4">
        <Mail class="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <div>
          <h2 class="display text-2xl">Dúvidas sobre os termos</h2>
          <p class="mt-2 text-sm leading-relaxed text-paper/65">
            Escreva para o mesmo canal usado para solicitações de
            privacidade.
          </p>
          <a
            class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
            href="mailto:privacidade@moto-track.app"
            >privacidade@moto-track.app <ArrowRight class="h-4 w-4" /></a
          >
        </div>
      </div>
    </div>
  </article>
</section>

<style>
  .legal-glow {
    top: -75%;
    right: -10%;
    width: 55%;
    height: 150%;
  }
  .legal-nav-link {
    transition:
      color 0.2s,
      border-color 0.2s;
  }
  .legal-nav-link:hover {
    color: var(--fg);
    border-left: 2px solid var(--accent);
    padding-left: calc(1rem - 2px);
  }
  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    opacity: 0.18;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }
</style>
