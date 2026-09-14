<script lang="ts">
  export let label: string;
  export let value: string;
  export let detail = "";
  /** When provided, the card is rendered as an anchor so the metric is
   *  navigable. Without href the card is a static <article> — the hover lift
   *  is removed so it doesn't create a false-affordance click target. */
  export let href: string | null = null;
</script>

{#if href}
  <a
    {href}
    class="panel group relative block min-w-0 overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
  >
    <!-- Slash motif, revealed on hover. -->
    <div class="corner-slashes" aria-hidden="true"></div>
    <p class="label-tech text-[var(--muted)]">{label}</p>
    <p class="display numeric mt-3 break-words text-4xl">{value}</p>
    {#if detail}
      <p class="mt-2 text-xs font-medium text-[var(--muted)]">{detail}</p>
    {/if}
  </a>
{:else}
  <article class="panel relative min-w-0 overflow-hidden p-5">
    <p class="label-tech text-[var(--muted)]">{label}</p>
    <p class="display numeric mt-3 break-words text-4xl">{value}</p>
    {#if detail}
      <p class="mt-2 text-xs font-medium text-[var(--muted)]">{detail}</p>
    {/if}
  </article>
{/if}

<style>
  .corner-slashes {
    position: absolute;
    top: -8px;
    right: -20px;
    width: 90px;
    height: 56px;
    pointer-events: none;
    opacity: 0;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 4px,
      transparent 4px 12px
    );
    transition: opacity 0.3s;
  }

  .group:hover .corner-slashes {
    opacity: 0.16;
  }
</style>
