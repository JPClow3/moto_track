<script context="module" lang="ts">
  export type Signal = {
    label: string;
    value: string;
    hint?: string;
  };
</script>

<script lang="ts">
  export let eyebrow = "";
  export let title = "";
  export let description = "";
  export let signals: Signal[] = [];

  $: displayedSignals = (signals ?? []).slice(0, 3);
</script>

{#if displayedSignals.length > 0}
  <div class="signal-strip border-y border-[var(--line)] py-3">
    {#if title}
      <div class="mb-2">
        {#if eyebrow}
          <p class="eyebrow text-[10px]">{eyebrow}</p>
        {/if}
        <h3 class="label-tech text-xs text-[var(--muted)]">{title}</h3>
        {#if description}
          <p class="text-xs text-[var(--muted)]">{description}</p>
        {/if}
      </div>
    {/if}

    <div
      class="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
    >
      {#each displayedSignals as signal, i (signal.label + i)}
        <div class="py-2.5 sm:px-4 sm:py-1 first:sm:pl-0 last:sm:pr-0">
          <p class="label-tech text-[10px] text-[var(--muted)]">
            {signal.label}
          </p>
          <p
            class="display numeric mt-0.5 text-2xl text-[var(--fg)] sm:text-3xl"
          >
            {signal.value}
          </p>
          {#if signal.hint}
            <p class="mt-0.5 text-xs text-[var(--muted)]">
              {signal.hint}
            </p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
