<script lang="ts">
  import Ellipsis from "lucide-svelte/icons/ellipsis";

  export let label = "Mais ações";
  export let align: "left" | "right" = "right";

  let details: HTMLDetailsElement;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && details?.open) {
      event.preventDefault();
      details.open = false;
      details.querySelector("summary")?.focus();
    }
  }

  function handleDocumentClick(event: MouseEvent) {
    if (details?.open && !details.contains(event.target as Node)) {
      details.open = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} on:click={handleDocumentClick} />

<details
  bind:this={details}
  class="page-overflow-menu relative inline-block text-left"
>
  <summary
    class="focus-ring flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] [&::-webkit-details-marker]:hidden"
    aria-label={label}
    title={label}
  >
    <slot name="trigger">
      <Ellipsis size={18} aria-hidden="true" />
    </slot>
  </summary>

  <div
    class="menu-content absolute top-full z-40 mt-1 min-w-[12rem] rounded border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-lift {align ===
    'right'
      ? 'right-0'
      : 'left-0'}"
    role="menu"
  >
    <slot />
  </div>
</details>
