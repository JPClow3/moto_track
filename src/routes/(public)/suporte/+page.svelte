<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { publicCopy } from "$lib/i18n/public-copy";
  import Mail from "lucide-svelte/icons/mail";
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import type { SiteContact } from "$server/domain/site-contact";

  let { data }: { data: { contact: SiteContact } } = $props();

  const c = (source: string) => publicCopy($locale, source);
  const links = [
    {
      href: "/instalar",
      title: "Instalar o app",
      body: "Instruções para celular e computador.",
    },
    {
      href: "/auth",
      title: "Recuperar acesso à conta",
      body: "Use Esqueci minha senha na tela de acesso para solicitar um e-mail de recuperação.",
    },
    {
      href: "/billing/conta",
      title: "Conta e assinatura",
      body: "Gerencie o plano, exporte seus dados ou solicite exclusão da conta. Requer login.",
    },
    {
      href: "/privacidade",
      title: "Privacidade e dados",
      body: "Entenda o uso dos dados e como exercer seus direitos.",
    },
  ];
</script>

<svelte:head
  ><title>{c("Suporte")} — Moto Track</title><meta
    name="description"
    content={c(
      "Ajuda com conta, instalação, cobrança e privacidade no Moto Track.",
    )}
  /><link rel="canonical" href="https://moto-track.net/suporte" /></svelte:head
>
<div class="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
  <p class="eyebrow">
    <span class="slash-rule" aria-hidden="true"></span>{c("Conte com a gente")}
  </p>
  <h1 class="display mt-5 text-5xl sm:text-7xl">{c("Suporte")}</h1>
  <p class="mt-6 max-w-2xl text-lg text-[var(--muted)]">
    {c(
      "Conte o que aconteceu, em qual página, e informe seu dispositivo e navegador. Nunca envie senhas, dados de cartão ou links de acesso privados.",
    )}
  </p>
  <a
    class="button-accent mt-8 max-w-full break-all"
    href={`mailto:${data.contact.supportEmail}`}
    ><Mail size={20} class="shrink-0" aria-hidden="true" />{data.contact
      .supportEmail}</a
  >
  <div class="mt-10 grid gap-5 sm:grid-cols-2">
    {#each links as link (link.href)}<a
        href={link.href}
        class="panel focus-ring group block p-6 transition hover:border-[var(--fg-soft)]"
        ><h2 class="display flex items-center justify-between gap-3 text-2xl">
          {c(link.title)}
          <ArrowRight
            size={20}
            class="shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </h2>
        <p class="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {c(link.body)}
        </p></a
      >{/each}
  </div>
  <p class="mt-8 text-sm text-[var(--muted)]">
    {c(
      "As informações de manutenção não substituem o manual do fabricante nem a avaliação de um profissional qualificado.",
    )}
  </p>
</div>
