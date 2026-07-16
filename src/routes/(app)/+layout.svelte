<script lang="ts">
  import AppShell from "$components/AppShell.svelte";
  import type { Snippet } from "svelte";

  let {
    data,
    children,
  }: {
    data: { user: unknown; currentPath: string; isStaff: boolean };
    children: Snippet;
  } = $props();
</script>

<AppShell
  user={data.user as never}
  currentPath={data.currentPath}
  isStaff={data.isStaff}
>
  {@render children()}
</AppShell>
