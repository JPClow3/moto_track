<script lang="ts">
  /**
   * A pending placeholder. Purely decorative: the surrounding region should
   * carry `aria-busy="true"` and the real content announces itself when it
   * lands, so a screen reader is never told about these blocks.
   */
  export let width = '100%';
  export let height = '1rem';
  /** Rendered as a stack of `lines` bars, the last one short like real text. */
  export let lines = 1;
  let className = '';
  export { className as class };

  $: indices = [...Array(lines).keys()];
</script>

{#if lines > 1}
  <div class={`grid gap-2 ${className}`} aria-hidden="true">
    {#each indices as index (index)}
      <div
        class="skeleton"
        style:height
        style:width={index === lines - 1 ? '60%' : width}
      ></div>
    {/each}
  </div>
{:else}
  <div class={`skeleton ${className}`} style:width style:height aria-hidden="true"></div>
{/if}
