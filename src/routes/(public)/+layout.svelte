<script lang="ts">
  import PublicHeader from "$components/PublicHeader.svelte";
  import PublicFooter from "$components/PublicFooter.svelte";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-screen flex-col">
  <PublicHeader />
  <main class="flex-1">
    {@render children()}
  </main>
  <PublicFooter />
</div>
