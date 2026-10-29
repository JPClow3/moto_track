<script lang="ts">
  export let label: string;
  export let value: string;
  export let detail = "";
  /** When provided, the card is rendered as an anchor so the metric is
   *  navigable. Without href the card is a static <article> — the hover state
   *  is removed so it doesn't create a false-affordance click target. */
  export let href: string | null = null;
</script>

{#if href}
  <a
    {href}
    class="panel focus-ring block min-w-0 p-5 transition-colors duration-200 hover:border-[var(--fg-soft)]"
  >
    <p class="label-tech text-[var(--muted)]">{label}</p>
    <p class="display numeric mt-3 break-words text-4xl">{value}</p>
    {#if detail}
      <p class="mt-2 text-xs font-medium text-[var(--muted)]">{detail}</p>
    {/if}
    <slot />
  </a>
{:else}
  <article class="panel min-w-0 p-5">
    <p class="label-tech text-[var(--muted)]">{label}</p>
    <p class="display numeric mt-3 break-words text-4xl">{value}</p>
    {#if detail}
      <p class="mt-2 text-xs font-medium text-[var(--muted)]">{detail}</p>
    {/if}
    <slot />
  </article>
{/if}
