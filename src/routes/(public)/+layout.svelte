<script lang="ts">
  import PublicHeader from "$components/PublicHeader.svelte";
  import PublicFooter from "$components/PublicFooter.svelte";
  import { t } from "$lib/i18n/store";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-screen flex-col">
  <a class="skip-link" href="#main-content">{$t("a11y.skipToContent")}</a>
  <PublicHeader />
  <main id="main-content" class="flex-1" tabindex="-1">
    {@render children()}
  </main>
  <PublicFooter />
</div>
