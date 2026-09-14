<script lang="ts">
  import Ellipsis from "lucide-svelte/icons/ellipsis";
  import { t } from "$lib/i18n/store";

  export let label = "";
  export let align: "left" | "right" = "right";

  let open = false;
  let triggerButton: HTMLButtonElement;

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      triggerButton?.focus();
    }
  }

  function handleDocumentClick(event: MouseEvent) {
    // Close if the click landed outside this component's subtree.
    const root = triggerButton?.closest(".page-overflow-menu");
    if (open && root && !root.contains(event.target as Node)) {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} on:click={handleDocumentClick} />

<div class="page-overflow-menu relative inline-block text-left">
  <button
    bind:this={triggerButton}
    type="button"
    class="focus-ring flex h-11 w-11 cursor-pointer items-center justify-center rounded border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)]"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={label || $t("authenticatedUx.moreActions")}
    title={label || $t("authenticatedUx.moreActions")}
    on:click={toggle}
  >
    <slot name="trigger">
      <Ellipsis size={18} aria-hidden="true" />
    </slot>
  </button>

  {#if open}
    <div
      class="menu-content absolute top-full z-40 mt-1 min-w-[12rem] rounded border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-lift {align ===
      'right'
        ? 'right-0'
        : 'left-0'}"
      role="menu"
    >
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div on:click={close}>
        <slot />
      </div>
    </div>
  {/if}
</div>
