<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { legalCopy } from "$lib/i18n/legal";
  $: copy = legalCopy($locale);
</script>

<svelte:head>
  <title>LGPD · Moto Track</title>
  <link rel="canonical" href="https://moto-track.net/lgpd" />
</svelte:head>

<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow legal-glow" aria-hidden="true"></div>
  <div class="relative mx-auto max-w-3xl px-6 py-16 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>
      {copy.lgpd.eyebrow}
    </p>
    <h1 class="display mt-5 text-5xl sm:text-6xl">LGPD</h1>
    <p class="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
      {copy.lgpd.introduction}
      <strong class="text-[var(--fg)]">{copy.lgpd.account}</strong>, {copy.lgpd
        .ending}
    </p>
    <a href="/privacidade" class="button-secondary mt-8">{copy.lgpd.privacy}</a>
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
