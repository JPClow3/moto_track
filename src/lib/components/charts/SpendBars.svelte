<script lang="ts">
  export let months: Array<{ month: string; cents: number }> = [];

  const brl = (cents: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00.000Z`).toLocaleDateString("pt-BR", {
      month: "short",
      timeZone: "UTC",
    });

  $: peak = months.reduce((high, entry) => Math.max(high, entry.cents), 0);
  $: total = months.reduce((sum, entry) => sum + entry.cents, 0);
  $: average = months.length ? total / months.length : 0;
  // The most recent month is the one the rider can still act on, so it carries
  // the accent and the rest stay graphite.
  $: latest = months.length - 1;
</script>

<div class="grid gap-4">
  <div class="flex items-end gap-6">
    <div>
      <p class="display numeric text-4xl">{brl(total)}</p>
      <p class="label-tech mt-1 text-[var(--muted)]">Total no período</p>
    </div>
    <div class="pb-1">
      <p class="numeric text-sm font-semibold">{brl(average)}</p>
      <p class="label-tech text-[10px] text-[var(--muted)]">Média / mês</p>
    </div>
  </div>

  <div class="flex h-40 items-end gap-2">
    {#each months as entry, i (entry.month)}
      <div class="group flex h-full flex-1 flex-col justify-end gap-2">
        <p
          class="numeric text-center text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 {i ===
          latest
            ? 'text-[var(--accent)]'
            : ''}"
        >
          {brl(entry.cents)}
        </p>
        <div
          class="bar"
          class:is-latest={i === latest}
          style={`--height:${peak ? Math.max((entry.cents / peak) * 100, entry.cents ? 2 : 0.8) : 0.8}%; --delay:${i * 70}ms`}
          title={`${monthLabel(entry.month)} — ${brl(entry.cents)}`}
        ></div>
        <p class="label-tech text-center text-[10px] text-[var(--muted)]">{monthLabel(entry.month)}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .bar {
    height: var(--height);
    min-height: 2px;
    border-radius: 2px 2px 0 0;
    background: color-mix(in srgb, var(--fg) 18%, transparent);
    transform-origin: bottom;
    animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    animation-delay: var(--delay);
    transition: background 0.2s;
  }

  .bar.is-latest {
    background: var(--accent);
  }

  .group:hover .bar {
    background: color-mix(in srgb, var(--fg) 38%, transparent);
  }

  .group:hover .bar.is-latest {
    background: var(--accent-hover);
  }

  @keyframes rise {
    from {
      transform: scaleY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar {
      animation: none;
    }
  }
</style>
