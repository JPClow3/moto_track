<script lang="ts">
  import type { Component, Snippet } from "svelte";

  // One designed block per page while there is no data: domain icon, one
  // sentence, one action. Replaces rendering the full data layout with dashes,
  // zeros and empty tables.
  let {
    icon: Icon = null,
    title,
    description = "",
    action,
    compact = false,
  }: {
    // Lucide icons are still Svelte 4 class components, so accept any component.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any> | (new (...args: any[]) => any) | null;
    title: string;
    description?: string;
    action?: Snippet;
    compact?: boolean;
  } = $props();
</script>

<div
  class="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--line)] px-6 text-center {compact
    ? 'py-8'
    : 'py-14'}"
>
  {#if Icon}
    <span
      class="grid h-12 w-12 place-items-center rounded-full bg-[var(--panel-sunken)] text-[var(--muted)]"
      aria-hidden="true"
    >
      <Icon size={24} />
    </span>
  {/if}
  <p class="text-base font-semibold text-[var(--fg)]">{title}</p>
  {#if description}
    <p class="max-w-sm text-sm text-[var(--muted)]">{description}</p>
  {/if}
  {#if action}
    <div class="mt-1">{@render action()}</div>
  {/if}
</div>
