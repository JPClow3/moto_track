<script lang="ts">
  import {
    ArrowRight,
    LockKeyhole,
    Mail,
    Printer,
    ShieldCheck,
  } from "lucide-svelte";

  const sections = [
    {
      id: "dados",
      title: "Dados que podemos tratar",
      paragraphs: [
        "Para criar e manter sua conta, podemos tratar dados de identificação e contato, como e-mail. Quando você usa o produto, também tratamos os registros que você escolhe adicionar: dados da moto, abastecimentos, manutenções, documentos, despesas, lembretes e preferências.",
        "Também podem ser tratados dados técnicos necessários para segurança e funcionamento, como registros de acesso, dispositivo, navegador e eventos de erro. Se a integração de Sentry estiver configurada, o navegador envia telemetria de erro e desempenho; a configuração do SDK desativa o envio padrão de dados pessoais, mas isso não substitui uma análise dos dados presentes em cada evento.",
        "A autenticação e o banco da aplicação usam Neon; arquivos enviados ficam no Cloudflare R2; cobranças recorrentes usam Stripe. Quando você solicita a leitura de um comprovante, o arquivo é enviado ao Mistral para OCR. Esses fornecedores podem tratar dados técnicos conforme suas configurações e contratos; os locais de processamento e prazos de retenção de cada fornecedor ainda precisam ser confirmados nesta versão.",
      ],
    },
    {
      id: "finalidades",
      title: "Para que usamos os dados",
      paragraphs: [
        "Usamos esses dados para fornecer a conta, guardar seus registros, calcular indicadores, enviar lembretes solicitados, oferecer suporte, prevenir fraude e melhorar a estabilidade do produto.",
        "Quando necessário, o tratamento ocorre para executar o serviço solicitado, cumprir obrigações legais, proteger direitos ou com base no seu consentimento. Você pode retirar consentimentos que forem opcionais, sem afetar tratamentos que já tenham outra base legal.",
      ],
    },
    {
      id: "compartilhamento",
      title: "Compartilhamento",
      paragraphs: [
        "Além dos serviços indicados acima, o Worker do Cloudflare pode enviar lembretes por e-mail e notificações push aos destinos configurados pelo usuário. Notificações push dependem do navegador e do serviço push associado ao dispositivo. Não publicamos aqui uma lista exaustiva de suboperadores nem as respectivas localidades de tratamento; essas informações precisam ser verificadas antes do lançamento comercial.",
        "Não vendemos dados pessoais. Dados podem ser compartilhados quando você solicitar, quando forem necessários para executar o serviço, para cumprir obrigação legal ou para proteger a segurança de pessoas e sistemas.",
      ],
    },
    {
      id: "seguranca",
      title: "Segurança e retenção",
      paragraphs: [
        "Adotamos medidas técnicas e organizacionais proporcionais para reduzir riscos de acesso indevido, alteração, perda ou divulgação. Nenhum ambiente conectado à internet é completamente imune a riscos; por isso, use uma senha forte e mantenha seus dispositivos protegidos.",
        "Ainda não publicamos prazos fixos de retenção por categoria de dado ou fornecedor. Os dados da conta são removidos quando uma solicitação de exclusão é atendida; a exclusão física de arquivos pode permanecer em uma fila operacional até que o Worker conclua a limpeza. Prazos de cópias de segurança, registros de cobrança e fornecedores precisam ser confirmados antes do lançamento comercial.",
      ],
    },
    {
      id: "direitos",
      title: "Seus direitos pela LGPD",
      paragraphs: [
        "Nos termos da Lei Geral de Proteção de Dados, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas, observados os limites legais.",
        "A área Conta oferece download direto de um arquivo JSON e também permite registrar solicitações de exportação ou exclusão para atendimento pela equipe. Uma solicitação de exclusão não apaga os dados imediatamente. Um canal monitorado para os demais direitos ainda não foi publicado nesta versão.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies e serviços de terceiros",
      paragraphs: [
        "A aplicação usa o cookie mt_session para manter a sessão por até sete dias e o cookie mt_oauth_challenge por até dez minutos durante o login social. A preferência de idioma fica em um cookie por até um ano; a preferência de tema é salva no localStorage do navegador. Ao usar o modo offline, o service worker armazena a página offline e o manifesto no Cache API, e envios de abastecimento aguardando sincronização ficam no IndexedDB até o envio ser concluído ou os dados locais serem removidos.",
        "O navegador também pode armazenar cookies ou dados próprios dos serviços de autenticação, cobrança, telemetria e notificações que você usar. Você pode limitar o armazenamento pelo navegador, mas isso pode impedir partes do Moto Track de funcionar corretamente.",
      ],
    },
    {
      id: "contato",
      title: "Contato e atualizações",
      paragraphs: [
        "Este texto ainda precisa de revisão jurídica. A identificação do controlador, um contato monitorado para privacidade, prazos de retenção e localidades de processamento ainda não foram informados nesta versão e precisam ser publicados antes do lançamento comercial. Quando esta política mudar de forma relevante, a data nesta página será atualizada.",
        "Para baixar seus dados ou registrar um pedido de exclusão, use a área Conta. O canal GitHub de relatos de segurança não é um canal de atendimento de direitos de privacidade; não envie dados pessoais em issues ou avisos públicos.",
      ],
    },
  ];
</script>

<svelte:head>
  <title>Política de Privacidade · Moto Track</title>
  <meta
    name="description"
    content="Política de Privacidade e informações LGPD do Moto Track."
  />
</svelte:head>

<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow legal-glow" aria-hidden="true"></div>
  <div class="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span> Privacidade e LGPD
    </p>
    <div class="mt-5 flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 class="display text-5xl sm:text-6xl lg:text-7xl">
          Seus dados,<br /><span class="text-[var(--accent)]"
            >no seu controle.</span
          >
        </h1>
        <p class="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Como o Moto Track trata dados para manter sua garagem organizada,
          segura e acessível.
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
      Última atualização: 23 de setembro de 2026
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
      aria-label="Seções de privacidade"
    >
      {#each sections as section, index (section.id)}
        <a
          class="focus-ring legal-nav-link inline-flex min-h-11 w-full items-center px-4 py-2 text-sm text-[var(--muted)]"
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
        <ShieldCheck class="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <p class="text-sm leading-relaxed text-[var(--muted)]">
          Solicite exportação ou exclusão pela área Conta.
        </p>
      </div>
      <div class="flex gap-3">
        <LockKeyhole class="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <p class="text-sm leading-relaxed text-[var(--muted)]">
          Tratamento limitado ao que é necessário para o serviço.
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
          <h2 class="display text-2xl">Solicitações de privacidade</h2>
          <p class="mt-2 text-sm leading-relaxed text-paper/65">
            Você pode baixar uma cópia JSON ou registrar um pedido de exclusão
            na área Conta. Um canal monitorado para outros pedidos ainda não foi
            publicado. Não use o formulário de segurança do GitHub nem uma issue
            pública para enviar dados pessoais.
          </p>
          <div class="mt-4 flex flex-wrap gap-4">
            <a
              class="focus-ring inline-flex min-h-11 items-center gap-2 rounded px-1 text-sm font-semibold text-[var(--accent)]"
              href="/billing/conta"
              >Gerenciar dados da conta <ArrowRight class="h-4 w-4" /></a
            >
          </div>
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
