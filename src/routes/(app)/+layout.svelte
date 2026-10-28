<script lang="ts">
  import AppShell from "$components/AppShell.svelte";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types";

  let {
    data,
    children,
  }: {
    data: LayoutData;
    children: Snippet;
  } = $props();
</script>

<AppShell
  user={data.user}
  isStaff={data.isStaff}
  motorcycles={data.motorcycles}
  activeMotorcycleId={data.activeMotorcycleId}
>
  {@render children()}
</AppShell>
