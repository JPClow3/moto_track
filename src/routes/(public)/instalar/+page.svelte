<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { publicCopy } from "$lib/i18n/public-copy";
  import Smartphone from "lucide-svelte/icons/smartphone";
  import Monitor from "lucide-svelte/icons/monitor";
  import WifiOff from "lucide-svelte/icons/wifi-off";

  const c = (source: string) => publicCopy($locale, source);
  const guides = [
    {
      title: "iPhone e iPad",
      icon: Smartphone,
      steps: [
        "Abra moto-track.net no Safari.",
        "Toque em Compartilhar e depois em Adicionar à Tela de Início. Pode ser necessário rolar a lista de ações.",
        "Confirme o nome e toque em Adicionar. Abra o Moto Track pelo novo ícone.",
      ],
    },
    {
      title: "Android",
      icon: Smartphone,
      steps: [
        "Abra moto-track.net no Chrome.",
        "No menu do navegador, escolha Instalar app ou Adicionar à tela inicial.",
        "Confirme a instalação e abra o Moto Track pela lista de aplicativos.",
      ],
    },
    {
      title: "Windows e macOS",
      icon: Monitor,
      steps: [
        "Abra moto-track.net no Chrome ou Edge.",
        "Use o ícone de instalação na barra de endereços ou a opção de instalar no menu do navegador.",
        "Confirme. O Moto Track abre em uma janela própria.",
      ],
    },
  ];
</script>

<svelte:head
  ><title>{c("Instale o Moto Track")}</title><meta
    name="description"
    content={c("Adicione o Moto Track à tela inicial pelo navegador.")}
  /><link rel="canonical" href="https://moto-track.net/instalar" /></svelte:head
>
<div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
  <p class="eyebrow">
    <span class="slash-rule" aria-hidden="true"></span>{c("Sempre à mão")}
  </p>
  <h1 class="display mt-5 max-w-3xl text-5xl sm:text-7xl">
    {c("Sua garagem, na tela inicial.")}
  </h1>
  <p class="mt-6 max-w-2xl text-lg text-[var(--muted)]">
    {c(
      "Instale o aplicativo web pelo navegador. Os nomes dos menus variam conforme o navegador e a versão do sistema. Você também pode continuar usando o Moto Track em uma aba.",
    )}
  </p>
  <div class="mt-10 grid gap-5 lg:grid-cols-3">
    {#each guides as guide (guide.title)}<section class="panel p-6">
        <guide.icon size={24} class="text-[var(--muted)]" aria-hidden="true" />
        <h2 class="display mt-5 text-3xl">{c(guide.title)}</h2>
        <ol
          class="mt-6 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-[var(--muted)]"
        >
          {#each guide.steps as step (step)}<li class="pl-1">
              {c(step)}
            </li>{/each}
        </ol>
      </section>{/each}
  </div>
  <div class="panel mt-8 flex items-start gap-4 p-6">
    <WifiOff
      size={24}
      class="shrink-0 text-[var(--muted)]"
      aria-hidden="true"
    />
    <div>
      <h2 class="font-semibold">{c("O que funciona sem internet?")}</h2>
      <p class="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        {c(
          "Depois do primeiro uso online, páginas compatíveis podem continuar disponíveis sem conexão e rascunhos de abastecimento podem aguardar a reconexão. Login, sincronização, pagamentos e uploads precisam de internet. Preserve os dados locais do navegador até sincronizar os rascunhos pendentes.",
        )}
      </p>
    </div>
  </div>
  <div class="mt-8 flex flex-wrap gap-3">
    <a href="/auth" class="button-accent">{c("Abrir Moto Track")}</a><a
      href="/demo"
      class="button-secondary">{c("Explorar demonstração")}</a
    ><a href="/suporte" class="button-secondary">{c("Preciso de ajuda")}</a>
  </div>
</div>
