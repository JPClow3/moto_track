<script lang="ts">
  export let cells: Array<{ date: string; count: number }> = [];

  const DAY_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];

  const LEVELS = [
    "var(--line)",
    "color-mix(in srgb, var(--accent) 25%, var(--panel))",
    "color-mix(in srgb, var(--accent) 55%, var(--panel))",
    "color-mix(in srgb, var(--accent) 78%, var(--panel))",
    "var(--accent)",
  ];

  const longDate = (iso: string) =>
    new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    });

  // Four filled steps, so a single busy day cannot flatten the whole scale.
  const levelFor = (count: number, peak: number) =>
    !count || !peak ? 0 : Math.min(4, Math.ceil((count / peak) * 4));

  $: max = cells.reduce((peak, cell) => Math.max(peak, cell.count), 0);
  $: scaled = cells.map((cell) => ({ ...cell, tone: LEVELS[levelFor(cell.count, max)] }));
  $: activeDays = cells.filter((cell) => cell.count > 0).length;
</script>

<div class="grid gap-3">
  <div class="flex items-start gap-2">
    <div class="grid shrink-0 gap-[3px]" style="grid-template-rows: repeat(7, 1fr)">
      {#each DAY_LABELS as day, i (i)}
        <span class="label-tech flex h-[13px] items-center text-[9px] text-[var(--muted)]">{day}</span>
      {/each}
    </div>
    <div class="heatmap flex-1">
      {#each scaled as cell (cell.date)}
        <div
          class="cell"
          style={`background:${cell.tone}`}
          title={`${longDate(cell.date)} — ${cell.count} ${cell.count === 1 ? "registro" : "registros"}`}
        ></div>
      {/each}
    </div>
  </div>

  <div class="flex items-center justify-between">
    <p class="text-xs text-[var(--muted)]">
      <span class="numeric font-semibold text-[var(--fg)]">{activeDays}</span> dias com registro
    </p>
    <div class="flex items-center gap-1.5">
      <span class="label-tech text-[9px] text-[var(--muted)]">Menos</span>
      {#each LEVELS as tone (tone)}
        <span class="cell" style={`background:${tone}`}></span>
      {/each}
      <span class="label-tech text-[9px] text-[var(--muted)]">Mais</span>
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
