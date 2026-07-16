<svelte:head><title>Cancelamento · Moto Track</title></svelte:head>

<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow legal-glow" aria-hidden="true"></div>
  <div class="relative mx-auto max-w-3xl px-6 py-16 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span> Sem pegadinha
    </p>
    <h1 class="display mt-5 text-5xl sm:text-6xl">Cancelamento</h1>
    <p class="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
      Assinaturas Pro são gerenciadas diretamente pelo portal do Stripe —
      cancele quando quiser, sem burocracia e sem precisar falar com ninguém.
    </p>
    <a href="/billing/portal" class="button-secondary mt-8"
      >Abrir portal de cobrança</a
    >
  </div>
</section>

<style>
  .legal-glow {
    top: -75%;
    right: -10%;
    width: 55%;
    height: 150%;
  }
</style>
