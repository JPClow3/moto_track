<script lang="ts">
  import { t, format } from "$lib/i18n/store";

  export let months: Array<{ month: string; cents: number }> = [];

  $: labelled = months.map((entry) => ({
    ...entry,
    label: $format.date(`${entry.month}-01T00:00:00.000Z`, {
      month: "short",
      timeZone: "UTC",
    }),
  }));

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
      <p class="display numeric text-4xl">{$format.money(total)}</p>
      <p class="label-tech mt-1 text-[var(--muted)]">
        {$t("dashboard.totalForPeriod")}
      </p>
    </div>
    <div class="pb-1">
      <p class="numeric text-sm font-semibold">{$format.money(average)}</p>
      <p class="label-tech text-[10px] text-[var(--muted)]">
        {$t("dashboard.perMonthAverage")}
      </p>
    </div>
  </div>

  <div class="flex h-40 items-end gap-2">
    {#each labelled as entry, i (entry.month)}
      <div class="group flex h-full flex-1 flex-col justify-end gap-2">
        <p
          class="numeric text-center text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 {i ===
          latest
            ? 'text-[var(--accent)]'
            : ''}"
        >
          {$format.money(entry.cents)}
        </p>
        <div
          class="bar"
          class:is-latest={i === latest}
          style={`--height:${peak ? Math.max((entry.cents / peak) * 100, entry.cents ? 2 : 0.8) : 0.8}%; --delay:${i * 70}ms`}
          title={`${entry.label} — ${$format.money(entry.cents)}`}
        ></div>
        <p class="label-tech text-center text-[10px] text-[var(--muted)]">
          {entry.label}
        </p>
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
