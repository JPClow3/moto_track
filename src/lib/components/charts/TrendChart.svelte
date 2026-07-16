<script lang="ts">
  import { t, format } from "$lib/i18n/store";

  export let points: Array<{ date: string; value: number }> = [];
  export let unit = "";
  /** Decimal places for the axis + marker readouts. */
  export let precision = 1;

  const W = 640;
  const H = 220;
  const PAD = { top: 18, right: 18, bottom: 30, left: 46 };
  const INNER_W = W - PAD.left - PAD.right;
  const INNER_H = H - PAD.top - PAD.bottom;
  const BASE_Y = H - PAD.bottom;

  // Plain helpers rather than reactive closures: everything they depend on is
  // either a constant or passed in explicitly.
  const xFor = (index: number, count: number) =>
    count < 2
      ? PAD.left + INNER_W / 2
      : PAD.left + (index * INNER_W) / (count - 1);
  const yFor = (value: number, min: number, max: number) =>
    PAD.top + (1 - (value - min) / (max - min)) * INNER_H;

  $: values = points.map((p) => p.value);
  $: rawMin = values.length ? Math.min(...values) : 0;
  $: rawMax = values.length ? Math.max(...values) : 1;
  // Headroom so the line never grazes the frame; a flat series still gets a band.
  $: span = rawMax - rawMin || Math.max(rawMax * 0.2, 1);
  $: min = rawMin - span * 0.15;
  $: max = rawMax + span * 0.15;

  $: coords = points.map((point, i) => ({
    x: xFor(i, points.length),
    y: yFor(point.value, min, max),
  }));

  $: linePath = coords
    .map((c, i) => `${i ? "L" : "M"} ${c.x} ${c.y}`)
    .join(" ");
  $: areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].x} ${BASE_Y} L ${coords[0].x} ${BASE_Y} Z`
    : "";

  // Four evenly spaced gridlines across the actual data range.
  $: gridlines = [0, 1, 2, 3].map((step) => {
    const value = rawMin + (span * step) / 3;
    return { value, y: yFor(value, min, max) };
  });

  $: last = points[points.length - 1];
  $: lastCoord = coords[coords.length - 1];
  $: axisDates = points.length
    ? [
        { point: points[0], x: PAD.left, anchor: "start" },
        {
          point: points[Math.floor((points.length - 1) / 2)],
          x: W / 2,
          anchor: "middle",
        },
        { point: last, x: W - PAD.right, anchor: "end" },
      ]
    : [];
</script>

<svg
  viewBox={`0 0 ${W} ${H}`}
  class="w-full"
  role="img"
  aria-label={$t("dashboard.trendAria", { count: points.length })}
>
  <defs>
    <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
    </linearGradient>
  </defs>

  {#each gridlines as gridline (gridline.value)}
    <line
      x1={PAD.left}
      y1={gridline.y}
      x2={W - PAD.right}
      y2={gridline.y}
      stroke="var(--line)"
      stroke-width="1"
      stroke-dasharray="3 5"
    />
    <text
      x={PAD.left - 10}
      y={gridline.y + 4}
      text-anchor="end"
      class="axis"
      fill="var(--muted)"
    >
      {$format.number(gridline.value, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      })}
    </text>
  {/each}

  {#if coords.length}
    <path class="area" d={areaPath} fill="url(#trend-fill)" />
    <path
      class="line"
      d={linePath}
      fill="none"
      stroke="var(--accent)"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Latest reading, called out like a live instrument readout. -->
    <circle
      class="marker"
      cx={lastCoord.x}
      cy={lastCoord.y}
      r="4.5"
      fill="var(--accent)"
    />
    <circle
      class="pulse"
      cx={lastCoord.x}
      cy={lastCoord.y}
      r="4.5"
      fill="var(--accent)"
    />

    {#each axisDates as entry, i (i)}
      {#if entry.point}
        <text
          x={entry.x}
          y={H - 8}
          text-anchor={entry.anchor}
          class="axis"
          fill="var(--muted)"
        >
          {$format.date(`${entry.point.date}T00:00:00.000Z`, {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          })}
        </text>
      {/if}
    {/each}
  {/if}
</svg>

{#if last}
  <p class="sr-only">
    {$t("dashboard.latestReading", {
      value: $format.number(last.value, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }),
      unit,
    })}
  </p>
{/if}

<style>
  .axis {
    font-family: "Barlow Condensed", Barlow, sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .line {
    stroke-dasharray: 1400;
    stroke-dashoffset: 1400;
    animation: draw 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .area {
    opacity: 0;
    animation: fade 0.8s ease 0.5s forwards;
  }

  .marker {
    opacity: 0;
    animation: fade 0.3s ease 1.2s forwards;
  }

  .pulse {
    transform-origin: center;
    transform-box: fill-box;
    opacity: 0;
    animation: ping 2s ease-out 1.4s infinite;
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes fade {
    to {
      opacity: 1;
    }
  }

  @keyframes ping {
    0% {
      opacity: 0.5;
      transform: scale(1);
    }
    70%,
    100% {
      opacity: 0;
      transform: scale(3.2);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .line,
    .area,
    .marker {
      animation: none;
      stroke-dashoffset: 0;
      opacity: 1;
    }

    .pulse {
      animation: none;
      opacity: 0;
    }
  }
</style>
