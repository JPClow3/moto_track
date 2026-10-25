<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { legalCopy } from "$lib/i18n/legal";
  $: copy = legalCopy($locale);
</script>

<svelte:head>
  <title>{copy.cancellation.title} · Moto Track</title>
  <link rel="canonical" href="https://moto-track.net/cancelamento" />
</svelte:head>

<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow legal-glow" aria-hidden="true"></div>
  <div class="relative mx-auto max-w-3xl px-6 py-16 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>
      {copy.cancellation.eyebrow}
    </p>
    <h1 class="display mt-5 text-5xl sm:text-6xl">{copy.cancellation.title}</h1>
    <p class="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
      {copy.cancellation.introduction}
    </p>
    <p class="mt-4 max-w-2xl leading-relaxed text-[var(--muted)]">
      {copy.cancellation.conditions}
    </p>
    <a href="/billing/portal" class="button-secondary mt-8"
      >{copy.cancellation.portal}</a
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
