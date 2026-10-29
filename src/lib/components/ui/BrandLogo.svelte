<script lang="ts">
  import { MARK_PATHS, MARK_VIEWBOX } from "$components/icons/mark-paths";

  // Mark + live-text wordmark. The old lockup was a traced bitmap whose
  // "MOTO TRACK" lettering rendered ~9px tall in the app header; setting the
  // wordmark in the brand face keeps it legible at any size and lets the
  // mark stand alone where space is tight.
  let {
    size = 24,
    wordmark = true,
    class: className = "",
  }: { size?: number; wordmark?: boolean; class?: string } = $props();
</script>

<span class="inline-flex items-center gap-2 {className}">
  <svg
    viewBox={MARK_VIEWBOX}
    height={size}
    width={Math.round((size * 752) / 300)}
    fill="#DC2626"
    fill-rule="evenodd"
    role="img"
    aria-label="Moto Track"
  >
    {#each MARK_PATHS as d (d)}<path {d} />{/each}
  </svg>
  {#if wordmark}
    <span
      class="wordmark text-[var(--fg)]"
      style="font-size: {Math.round(size * 0.72)}px"
      aria-hidden="true">Moto Track</span
    >
  {/if}
</span>

<style>
  .wordmark {
    font-stretch: 80%;
    font-weight: 800;
    font-style: oblique 8deg;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    line-height: 1;
    white-space: nowrap;
  }
</style>
