<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Plus from "lucide-svelte/icons/plus";

  export let label: string;
  export let ariaLabel: string = label;
  export let disabled = false;
  export let type: "button" | "submit" = "button";

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  function handleClick(event: MouseEvent) {
    dispatch("click", event);
  }
</script>

<button
  {type}
  {disabled}
  aria-label={ariaLabel || label}
  on:click={handleClick}
  class="page-action button-accent flex h-12 w-12 items-center justify-center rounded-full p-0 shadow-lg lg:h-auto lg:w-auto lg:rounded lg:px-4 lg:py-2.5 lg:shadow-none"
>
  <slot name="icon">
    <Plus size={20} aria-hidden="true" class="shrink-0" />
  </slot>
  {#if label}
    <span class="hidden font-semibold lg:inline">{label}</span>
  {/if}
</button>
