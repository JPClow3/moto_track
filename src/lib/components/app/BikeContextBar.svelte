<script lang="ts">
  import Bike from "lucide-svelte/icons/bike";
  import { t } from "$lib/i18n/store";

  export let name: string;
  export let model = "";
  export let odometerKm: number | string | null = null;
  export let imageUrl: string | null = null;
  export let ariaLabel = "";
</script>

<div
  class="bike-context-bar panel flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4 sm:py-3"
  aria-label={ariaLabel || $t("nav.garage")}
>
  <div class="flex min-w-0 items-center gap-3">
    {#if imageUrl}
      <img
        src={imageUrl}
        alt={name}
        class="h-10 w-10 shrink-0 rounded border border-[var(--line)] object-cover"
      />
    {:else}
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--line)] bg-[var(--accent-soft)] text-[var(--accent)]"
        aria-hidden="true"
      >
        <Bike size={20} />
      </div>
    {/if}

    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <span
          class="truncate text-sm font-semibold text-[var(--fg)] sm:text-base"
        >
          {name}
        </span>
        {#if model}
          <span class="hidden truncate text-xs text-[var(--muted)] sm:inline">
            · {model}
          </span>
        {/if}
      </div>
      {#if odometerKm !== null && odometerKm !== undefined}
        <p class="label-tech text-[11px] text-[var(--muted)]">
          <span class="numeric font-medium text-[var(--fg)]">{odometerKm}</span> km
        </p>
      {/if}
    </div>
  </div>

  <div class="flex shrink-0 items-center gap-2">
    <slot name="selection" />
    <slot />
  </div>
</div>
