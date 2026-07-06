<script lang="ts">
  import AppShell from '$components/AppShell.svelte';
  import type { Snippet } from 'svelte';

  let { data, children }: { data: { user: unknown; currentPath: string }; children: Snippet } = $props();
</script>

<AppShell user={data.user as never} currentPath={data.currentPath}>
  {@render children()}
</AppShell>
