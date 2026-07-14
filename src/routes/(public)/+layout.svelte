<script lang="ts">
  import PublicHeader from '$components/PublicHeader.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<PublicHeader />
<main>
  {@render children()}
</main>
