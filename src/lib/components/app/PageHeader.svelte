<script lang="ts">
  export let title: string;
  export let description = "";
</script>

<!-- No eyebrow: the title already says where you are. Title and actions share
     a row; when the actions don't fit beside the title they wrap together as
     one right-aligned group, so the overflow menu never sits alone. -->
<header class="page-header border-b border-[var(--line)] pb-5 pt-1">
  <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
    <h1
      class="display min-w-0 flex-[1_1_12rem] text-3xl tracking-tight text-[var(--fg)]"
    >
      {title}
    </h1>

    {#if $$slots.actions || $$slots.overflow}
      <div
        class="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2"
      >
        <slot name="actions" />
        <slot name="overflow" />
      </div>
    {/if}
  </div>

  {#if description}
    <p class="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
      {description}
    </p>
  {/if}
  <slot />

  <slot name="context" />
</header>
