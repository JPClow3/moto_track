<script lang="ts">
  export let label: string;
  export let value: string;
  export let detail = '';
</script>

<article class="panel group relative overflow-hidden p-5 transition-colors hover:border-[var(--accent)]">
  <!-- Slash motif, revealed on hover rather than a permanent gradient wash. -->
  <div class="corner-slashes" aria-hidden="true"></div>
  <p class="label-tech text-[var(--muted)]">{label}</p>
  <p class="display numeric mt-3 text-4xl">{value}</p>
  {#if detail}
    <p class="mt-2 text-xs font-medium text-[var(--muted)]">{detail}</p>
  {/if}
</article>

<style>
  .corner-slashes {
    position: absolute;
    top: -8px;
    right: -20px;
    width: 90px;
    height: 56px;
    pointer-events: none;
    opacity: 0;
    background: repeating-linear-gradient(100deg, var(--accent) 0 4px, transparent 4px 12px);
    transition: opacity 0.3s;
  }

  .group:hover .corner-slashes {
    opacity: 0.16;
  }
</style>
