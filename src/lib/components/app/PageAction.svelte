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

<!-- The page's "add" action, inline in the page header at every size. Ink,
     never red: the global quick-log + in the phone bar replaced the old
     floating FAB, so this no longer floats over content. -->
<button
  {type}
  {disabled}
  aria-label={ariaLabel || label}
  on:click={handleClick}
  class="page-action button-primary"
>
  <slot name="icon">
    <Plus size={20} aria-hidden="true" class="shrink-0" />
  </slot>
  {#if label}
    <span class="page-action-label">{label}</span>
  {/if}
</button>
