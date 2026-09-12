<script lang="ts">
  export let eyebrow = "";
  export let title: string;
  export let description = "";
</script>

<header class="page-header border-b border-[var(--line)] pb-5 pt-1">
  <div
    class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
  >
    <div class="min-w-0 flex-1">
      {#if eyebrow}
        <div class="eyebrow mb-1.5">
          <span class="slash-rule slash-rule--sm" aria-hidden="true"></span>
          <span>{eyebrow}</span>
        </div>
      {/if}
      <h1 class="display text-3xl tracking-tight text-[var(--fg)] sm:text-4xl">
        {title}
      </h1>
      {#if description}
        <p class="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
          {description}
        </p>
      {/if}
      <slot />
    </div>

    <div class="flex shrink-0 items-center gap-2.5 sm:self-start">
      <slot name="actions" />
      <slot name="overflow" />
    </div>
  </div>

  <slot name="context" />
</header>
