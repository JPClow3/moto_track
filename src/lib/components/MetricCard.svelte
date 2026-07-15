<script lang="ts">
  export let label: string;
  export let value: string;
  export let detail = '';
</script>

<article class="panel p-5 bg-[var(--bg)]/60 backdrop-blur-md hover:-translate-y-0.5 hover:shadow-md hover:border-signal/30 transition-all duration-300 relative overflow-hidden group">
  <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--fg)]/5 to-transparent rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-500"></div>
  <p class="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
  <p class="mt-3 text-3xl font-black text-ink dark:text-white">{value}</p>
  {#if detail}
    <p class="mt-2 text-xs font-medium text-[var(--muted)]">{detail}</p>
  {/if}
</article>
