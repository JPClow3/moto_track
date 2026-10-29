<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { formatDistance, formatMoney } from "$lib/i18n";
  import { publicCopy } from "$lib/i18n/public-copy";

  let { kind = "cost" }: { kind?: "cost" | "service" | "reminder" } = $props();

  const c = (source: string) => publicCopy($locale, source);
  const title = $derived(
    c(
      kind === "cost"
        ? "Conheça seu custo por km"
        : kind === "service"
          ? "Construa seu histórico"
          : "Veja o próximo cuidado",
    ),
  );

  // Fixed dark surface, so these are literal zinc / status values rather than
  // theme tokens: amber-400 for "due soon", green-400 for "done", and the
  // brand red only in the logo's speed-mark.
  const INK = {
    fg: "#fafafa",
    muted: "#a1a1aa",
    faint: "#71717a",
    bar: "#52525b",
    ring: "#27272a",
    ok: "#4ade80",
    due: "#fbbf24",
    brand: "#ef4444",
  };

  const services = [
    { label: "Óleo e filtro", km: 12000 },
    { label: "Freios revisados", km: 11500 },
    { label: "Pneus verificados", km: 11000 },
  ];
</script>

<svg
  viewBox="0 0 640 400"
  role="img"
  aria-label={title}
  class="motion w-full rounded bg-ink text-paper"
>
  <title>{title}</title>
  <defs
    ><pattern
      id={"grid-" + kind}
      width="40"
      height="40"
      patternUnits="userSpaceOnUse"
      ><path
        d="M40 0H0V40"
        fill="none"
        stroke="#ffffff"
        stroke-opacity=".05"
      /></pattern
    ></defs
  >
  <rect width="640" height="400" fill={"url(#grid-" + kind + ")"} />
  <path
    d="M40 38l-7 20m20-20-7 20m20-20-7 20"
    stroke={INK.brand}
    stroke-width="5"
  />
  <text x="92" y="56" fill={INK.muted} font-size="20" letter-spacing="3"
    >MOTO TRACK</text
  >
  {#if kind === "cost"}
    <text x="40" y="125" fill={INK.muted} font-size="22">{c("Custo / km")}</text
    >
    <text
      x="36"
      y="218"
      fill={INK.fg}
      font-size="90"
      font-weight="750"
      class="condensed">{formatMoney($locale, 41)}</text
    >
    {#each [40, 55, 48, 70, 63, 85, 72, 96] as height, i (i)}
      <rect
        class="bar"
        x={370 + i * 26}
        y={230 - height}
        width="17"
        {height}
        fill={i === 7 ? INK.fg : INK.bar}
        style={"--delay:" + i * 90 + "ms"}
      />
    {/each}
    <path
      class="trace"
      d="M40 286H600"
      stroke={INK.bar}
      stroke-width="3"
      pathLength="1"
    />
    <text x="40" y="335" fill={INK.fg} font-size="28" class="condensed"
      >{c("Cada quilômetro conta.")}</text
    >
  {:else if kind === "service"}
    <path
      class="trace"
      d="M68 124V300"
      stroke={INK.bar}
      stroke-width="3"
      pathLength="1"
    />
    {#each services as service, i (service.label)}
      <g class="entry" style={"--delay:" + i * 450 + "ms"}>
        <circle cx="68" cy={130 + i * 82} r="9" fill={INK.ok} />
        <text x="100" y={138 + i * 82} fill={INK.fg} font-size="26"
          >{c(service.label)}</text
        >
        <text x="100" y={164 + i * 82} fill={INK.muted} font-size="20"
          >{formatDistance($locale, service.km)}</text
        >
        <path
          d={`M545 ${126 + i * 82}l8 8 17-18`}
          fill="none"
          stroke={INK.ok}
          stroke-width="3"
        />
      </g>
    {/each}
  {:else}
    <circle
      class="ring"
      cx="320"
      cy="175"
      r="83"
      fill="none"
      stroke={INK.due}
      stroke-width="2"
    />
    <circle cx="320" cy="175" r="65" fill={INK.ring} />
    <path
      d="M296 188v-24a24 24 0 0148 0v24l9 12h-66zm17 22a8 8 0 0014 0"
      fill="none"
      stroke={INK.due}
      stroke-width="4"
      stroke-linejoin="round"
    />
    <text
      x="320"
      y="300"
      text-anchor="middle"
      fill={INK.fg}
      font-size="34"
      class="condensed">{c("Troca de óleo em 520 km")}</text
    >
    <text x="320" y="338" text-anchor="middle" fill={INK.muted} font-size="22"
      >{c("Por data ou quilometragem.")}</text
    >
  {/if}
  <text x="40" y="382" fill={INK.faint} font-size="20"
    >{c("Dados ilustrativos")}</text
  >
</svg>

<style>
  .motion {
    font-family: var(--font-sans);
  }
  .condensed {
    font-stretch: 76%;
    font-weight: 750;
  }
  .bar {
    transform-box: fill-box;
    transform-origin: bottom;
    animation: grow 1s cubic-bezier(0.22, 1, 0.36, 1) var(--delay) both;
  }
  .trace {
    stroke-dasharray: 1;
    animation: trace 1.6s ease both;
  }
  .entry {
    animation: enter 0.7s ease var(--delay) both;
  }
  .ring {
    transform-origin: 320px 175px;
    animation: pulse 1.8s ease 2 both;
  }
  @keyframes grow {
    from {
      transform: scaleY(0.02);
    }
  }
  @keyframes trace {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes enter {
    from {
      transform: translateX(12px);
    }
    to {
      transform: translateX(0);
    }
  }
  @keyframes pulse {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    45% {
      opacity: 0.8;
    }
    100% {
      transform: scale(1.2);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bar,
    .trace,
    .entry,
    .ring {
      animation: none;
    }
    .ring {
      opacity: 0.3;
    }
  }
</style>
