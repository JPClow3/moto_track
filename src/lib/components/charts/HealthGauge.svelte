<script lang="ts">
  export let score: number;
  export let status: string;

  const R = 78;
  const CX = 100;
  const CY = 96;
  // Half-circle sweep, so the arc reads like an instrument dial.
  const LENGTH = Math.PI * R;
  const TICKS = [...Array(11).keys()];

  $: clamped = Math.max(0, Math.min(100, score));
  $: offset = LENGTH * (1 - clamped / 100);
  // Red is the "needs action" signal everywhere else in the product, so the dial
  // only earns it once the score actually drops.
  $: tone = clamped < 50 ? "var(--accent)" : clamped < 80 ? "var(--warning)" : "var(--fg)";
</script>

<div class="flex flex-col items-center">
  <svg viewBox="0 0 200 118" class="w-full max-w-[240px]" role="img" aria-label={`Saúde da moto: ${clamped} de 100. ${status}`}>
    <!-- Track -->
    <path
      d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
      fill="none"
      stroke="var(--line)"
      stroke-width="10"
      stroke-linecap="butt"
    />
    <!-- Tick marks every 10%, echoing the speed-mark motif. -->
    {#each TICKS as i (i)}
      {@const angle = Math.PI - (i / 10) * Math.PI}
      {@const x1 = CX + Math.cos(angle) * (R - 10)}
      {@const y1 = CY - Math.sin(angle) * (R - 10)}
      {@const x2 = CX + Math.cos(angle) * (R - 16)}
      {@const y2 = CY - Math.sin(angle) * (R - 16)}
      <line {x1} {y1} {x2} {y2} stroke="var(--line)" stroke-width={i % 5 === 0 ? 2 : 1} />
    {/each}
    <!-- Value -->
    <path
      class="dial"
      d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
      fill="none"
      stroke={tone}
      stroke-width="10"
      stroke-linecap="butt"
      stroke-dasharray={LENGTH}
      style={`--dial-offset:${offset}; --dial-length:${LENGTH}`}
    />
  </svg>
  <div class="-mt-10 text-center">
    <p class="display numeric text-6xl leading-none" style={`color:${tone}`}>{clamped}</p>
    <p class="label-tech mt-2 text-[var(--muted)]">{status}</p>
  </div>
</div>

<style>
  .dial {
    stroke-dashoffset: var(--dial-length);
    animation: sweep 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes sweep {
    to {
      stroke-dashoffset: var(--dial-offset);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dial {
      animation: none;
      stroke-dashoffset: var(--dial-offset);
    }
  }
</style>
