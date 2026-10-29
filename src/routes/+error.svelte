<script lang="ts">
  import { page } from "$app/stores";
  import { t } from "$lib/i18n/store";
  import BrandLogo from "$components/ui/BrandLogo.svelte";

  // There was no +error.svelte at all, so any failure fell through to
  // SvelteKit's bare default page — no nav, no way back. That is why a 500 on
  // /precos left you stranded on the marketing site.
  const isNotFound = $derived($page.status === 404);
  const user = $derived(($page.data as { user?: unknown }).user ?? null);
  const home = $derived(user ? "/dashboard" : "/");
</script>

<svelte:head>
  <title
    >{isNotFound ? $t("error.notFoundTitle") : $t("error.title")} · Moto Track</title
  >
</svelte:head>

<main
  class="relative grid min-h-screen place-items-center overflow-hidden px-6 py-24"
>
  <div class="grid-backdrop" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-lg text-center">
    <a
      href={home}
      class="focus-ring mb-10 inline-flex min-h-11 items-center rounded transition hover:opacity-70"
    >
      <BrandLogo size={24} />
    </a>

    <!-- The status code is the one real error indicator here: danger-toned
         for a failure, neutral for a page that simply isn't there. -->
    <p
      class="label-tech mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1 {isNotFound
        ? 'bg-[var(--panel-sunken)] text-[var(--muted)]'
        : 'bg-[var(--danger-soft)] text-[var(--danger)]'}"
    >
      <span class="numeric">{$t("error.code", { status: $page.status })}</span>
    </p>

    <h1 class="display mt-5 text-5xl sm:text-6xl">
      {isNotFound ? $t("error.notFoundTitle") : $t("error.title")}
    </h1>

    <p class="mt-5 text-lg text-[var(--muted)]">
      {isNotFound ? $t("error.notFoundBody") : $t("error.serverBody")}
    </p>

    <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
      {#if user}
        <a class="button-primary px-6 py-3" href="/dashboard"
          >{$t("error.backToDashboard")}</a
        >
      {:else}
        <a class="button-primary px-6 py-3" href="/">{$t("error.backToHome")}</a
        >
      {/if}
    </div>
  </div>
</main>
