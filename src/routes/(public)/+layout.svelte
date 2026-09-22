<script lang="ts">
  import PublicHeader from "$components/PublicHeader.svelte";
  import PublicFooter from "$components/PublicFooter.svelte";
  import { t } from "$lib/i18n/store";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <meta property="og:site_name" content="Moto Track" />
  <meta property="og:type" content="website" />
  <meta
    property="og:image"
    content="https://moto-track.net/brand/og-card.png"
  />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:image"
    content="https://moto-track.net/brand/og-card.png"
  />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <a class="skip-link" href="#main-content">{$t("a11y.skipToContent")}</a>
  <PublicHeader />
  <main id="main-content" class="flex-1" tabindex="-1">
    {@render children()}
  </main>
  <PublicFooter />
</div>
