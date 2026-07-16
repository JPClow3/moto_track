<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/i18n/store';

  // There was no +error.svelte at all, so any failure fell through to
  // SvelteKit's bare default page — no nav, no way back. That is why a 500 on
  // /precos left you stranded on the marketing site.
  const isNotFound = $derived($page.status === 404);
  const user = $derived(($page.data as { user?: unknown }).user ?? null);
</script>

<svelte:head>
  <title>{isNotFound ? $t('error.notFoundTitle') : $t('error.title')} · Moto Track</title>
</svelte:head>

<main class="relative grid min-h-screen place-items-center overflow-hidden px-6 py-24">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow error-glow" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-lg text-center">
    <p class="eyebrow justify-center">
      <span class="slash-rule" aria-hidden="true"></span>
      {$t('error.code', { status: $page.status })}
    </p>

    <h1 class="display mt-5 text-5xl sm:text-6xl">
      {isNotFound ? $t('error.notFoundTitle') : $t('error.title')}
    </h1>

    <p class="mt-5 text-lg text-[var(--muted)]">
      {isNotFound ? $t('error.notFoundBody') : $t('error.serverBody')}
    </p>

    <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
      {#if user}
        <a class="button-primary px-6 py-3" href="/dashboard">{$t('error.backToDashboard')}</a>
      {:else}
        <a class="button-primary px-6 py-3" href="/">{$t('error.backToHome')}</a>
      {/if}
    </div>
  </div>
</main>

<style>
  .error-glow {
    top: -10%;
    left: 50%;
    width: 60%;
    height: 70%;
    transform: translateX(-50%);
  }
</style>
