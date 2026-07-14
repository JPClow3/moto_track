<script lang="ts">
  export let label: string;
  export let value: string;
  export let detail = '';
</script>

<article class="panel p-4">
  <p class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
  <p class="mt-3 text-2xl font-bold">{value}</p>
  {#if detail}<p class="mt-1 text-sm text-[var(--muted)]">{detail}</p>{/if}
</article>
