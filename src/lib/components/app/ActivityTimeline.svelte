<script lang="ts" generics="T = Record<string, unknown>">
  export let title = "";
  export let emptyMessage = "Nenhuma atividade registrada ainda.";
  export let items: T[] | null = null;
</script>

<section class="activity-timeline" aria-label={title || "Atividades"}>
  {#if title}
    <div class="mb-3 flex items-center justify-between">
      <h2 class="label-tech text-xs text-[var(--muted)]">{title}</h2>
      <slot name="header-action" />
    </div>
  {/if}

  {#if items && items.length === 0}
    <div class="timeline-empty panel p-8 text-center">
      <slot name="empty">
        <p class="text-sm text-[var(--muted)]">
          {emptyMessage}
        </p>
      </slot>
    </div>
  {:else}
    <div
      class="timeline-stream space-y-0 divide-y divide-[var(--line)] border-y border-[var(--line)]"
    >
      {#if items}
        {#each items as item, index}
          <div class="timeline-item py-3">
            <slot name="item" {item} {index}>
              <slot />
            </slot>
          </div>
        {/each}
      {:else}
        <slot />
      {/if}
    </div>
  {/if}
</section>
