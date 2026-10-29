<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { publicCopy } from "$lib/i18n/public-copy";

  const c = (source: string) => publicCopy($locale, source);
</script>

<svelte:head
  ><title>{c("Sobre este app")} — Moto Track</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>
<div class="mx-auto max-w-3xl px-4 py-16 sm:px-6">
  <p class="eyebrow">
    <span class="slash-rule" aria-hidden="true"></span>Moto Track
  </p>
  <h1 class="display mt-5 text-5xl">{c("A conta da sua moto.")}</h1>
  <p class="mt-6 text-lg text-[var(--muted)]">
    {c(
      "Este app permite acessar sua conta Moto Track. Compras e alterações de assinatura não estão disponíveis nesta versão.",
    )}
  </p>
  <p class="mt-4 text-sm text-[var(--muted)]">
    {c(
      "Você pode exportar seus dados ou solicitar exclusão em Conta. Para obter ajuda, entre em contato com o suporte.",
    )}
  </p>
  <div class="mt-8 flex flex-wrap gap-3">
    <a class="button-primary" href="/dashboard">{c("Abrir minha conta")}</a><a
      class="button-secondary"
      href="/suporte">{c("Suporte")}</a
    ><a class="button-secondary" href="/privacidade">{c("Privacidade")}</a>
  </div>
</div>
