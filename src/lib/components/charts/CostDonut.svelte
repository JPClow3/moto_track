<script lang="ts">
  export let slices: Array<{ key: string; label: string; cents: number }> = [];

  const R = 54;
  const C = 2 * Math.PI * R;

  // A graduated ramp of the one brand red rather than four competing hues —
  // mixed toward --panel so it re-tunes itself in dark mode.
  const TONES = [
    "var(--accent)",
    "color-mix(in srgb, var(--accent) 60%, var(--panel))",
    "color-mix(in srgb, var(--accent) 32%, var(--panel))",
    "color-mix(in srgb, var(--accent) 15%, var(--panel))",
  ];

  const brl = (cents: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  $: total = slices.reduce((sum, slice) => sum + slice.cents, 0);
  $: segments = slices.map((slice, i) => {
    const offset = slices
      .slice(0, i)
      .reduce((sum, previous) => sum + previous.cents, 0);
    return {
      ...slice,
      tone: TONES[i] ?? TONES[TONES.length - 1],
      length: total ? (slice.cents / total) * C : 0,
      offset: total ? (offset / total) * C : 0,
      percent: total ? Math.round((slice.cents / total) * 100) : 0,
    };
  });
</script>

<div class="flex flex-col items-center gap-5">
  <div class="relative">
    <svg viewBox="0 0 140 140" class="w-[168px]" role="img" aria-label={`Custos por categoria, total ${brl(total)}`}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" stroke-width="16" />
      {#each segments as segment, i (segment.key)}
        <circle
          class="segment"
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={segment.tone}
          stroke-width="16"
          stroke-dasharray={`${segment.length} ${C - segment.length}`}
          stroke-dashoffset={-segment.offset}
          style={`--delay:${i * 120}ms`}
        />
      {/each}
    </svg>
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <p class="display numeric text-2xl">{brl(total)}</p>
      <p class="label-tech mt-0.5 text-[10px] text-[var(--muted)]">Total</p>
    </div>
  </div>

  <ul class="grid w-full gap-2">
    {#each segments as segment (segment.key)}
      <li class="flex items-center gap-3 text-sm">
        <span class="swatch" style={`background:${segment.tone}`} aria-hidden="true"></span>
        <span class="flex-1 text-[var(--muted)]">{segment.label}</span>
        <span class="numeric font-semibold">{brl(segment.cents)}</span>
        <span class="numeric label-tech w-9 text-right text-[var(--muted)]">{segment.percent}%</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .swatch {
    width: 9px;
    height: 9px;
    flex-shrink: 0;
    /* The logo's speed-mark skew, reused as the legend key. */
    transform: skewX(-24deg);
  }

  .segment {
    transform: rotate(-90deg);
    transform-origin: center;
    animation: grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    animation-delay: var(--delay);
  }

  @keyframes grow {
    from {
      opacity: 0;
      stroke-dasharray: 0 999;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .segment {
      animation: none;
    }
  }
</style>
