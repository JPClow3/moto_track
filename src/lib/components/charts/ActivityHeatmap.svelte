<script lang="ts">
  import { t, format } from "$lib/i18n/store";

  export let cells: Array<{ date: string; count: number }> = [];

  const LEVELS = [
    "var(--line)",
    "color-mix(in srgb, var(--accent) 25%, var(--panel))",
    "color-mix(in srgb, var(--accent) 55%, var(--panel))",
    "color-mix(in srgb, var(--accent) 78%, var(--panel))",
    "var(--accent)",
  ];

  // Four filled steps, so a single busy day cannot flatten the whole scale.
  const levelFor = (count: number, peak: number) =>
    !count || !peak ? 0 : Math.min(4, Math.ceil((count / peak) * 4));

  $: max = cells.reduce((peak, cell) => Math.max(peak, cell.count), 0);
  $: scaled = cells.map((cell) => ({
    ...cell,
    tone: LEVELS[levelFor(cell.count, max)],
    title: `${$format.date(`${cell.date}T00:00:00.000Z`, {
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    })} — ${$t(
      cell.count === 1 ? "feature.recordCountOne" : "feature.recordCountOther",
      { count: cell.count },
    )}`,
  }));
  $: activeDays = cells.filter((cell) => cell.count > 0).length;

  // Derived from the first column's real dates (which activityCalendar aligns
  // to Monday) rather than a hardcoded list, so the initials follow the locale.
  $: dayLabels = cells.slice(0, 7).map((cell) =>
    $format.date(`${cell.date}T00:00:00.000Z`, {
      weekday: "narrow",
      timeZone: "UTC",
    }),
  );
</script>

<div class="grid gap-3">
  <div class="flex items-start gap-2">
    <div
      class="grid shrink-0 gap-[3px]"
      style="grid-template-rows: repeat(7, 1fr)"
      aria-hidden="true"
    >
      {#each dayLabels as day, i (i)}
        <span
          class="label-tech flex h-[13px] items-center text-[9px] text-[var(--muted)]"
          >{day}</span
        >
      {/each}
    </div>
    <div class="heatmap flex-1">
      {#each scaled as cell (cell.date)}
        <div
          class="cell"
          style={`background:${cell.tone}`}
          title={cell.title}
        ></div>
      {/each}
    </div>
  </div>

  <div class="flex items-center justify-between">
    <p class="text-xs text-[var(--muted)]">
      {$t("dashboard.activeDays", { count: activeDays })}
    </p>
    <div class="flex items-center gap-1.5">
      <span class="label-tech text-[9px] text-[var(--muted)]"
        >{$t("dashboard.less")}</span
      >
      {#each LEVELS as tone (tone)}
        <span class="cell" style={`background:${tone}`}></span>
      {/each}
      <span class="label-tech text-[9px] text-[var(--muted)]"
        >{$t("dashboard.more")}</span
      >
    </div>
  </div>
</div>

<style>
  .heatmap {
    display: grid;
    grid-template-rows: repeat(7, 13px);
    grid-auto-flow: column;
    grid-auto-columns: 13px;
    gap: 3px;
    /* Long histories scroll rather than squeezing the cells into slivers. */
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .cell {
    width: 13px;
    height: 13px;
    border-radius: 1px;
    transform: skewX(-12deg);
    transition: outline-color 0.15s;
    outline: 1px solid transparent;
  }

  .heatmap .cell:hover {
    outline-color: var(--fg);
  }
</style>
