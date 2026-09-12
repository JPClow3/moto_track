<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import X from "lucide-svelte/icons/x";

  export let title: string;
  export let description = "";
  export let closeLabel = "Fechar";
  export let dismissible = true;

  const dispatch = createEventDispatcher<{
    close: { reason: string };
  }>();

  let dialog: HTMLDialogElement;
  let returnFocus: HTMLElement | null = null;

  export function open() {
    if (typeof document !== "undefined") {
      returnFocus = document.activeElement as HTMLElement | null;
    }
    if (dialog && typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  }

  export function close(reason = "cancel") {
    if (dialog && dialog.open && typeof dialog.close === "function") {
      dialog.close(reason);
    }
  }

  function handleClose() {
    const reason = dialog?.returnValue || "cancel";
    dispatch("close", { reason });
    if (returnFocus && typeof returnFocus.focus === "function") {
      returnFocus.focus();
    }
    returnFocus = null;
  }

  function handleCancel(event: Event) {
    if (!dismissible) {
      event.preventDefault();
      return;
    }
  }

  function onBackdropClick(event: MouseEvent) {
    if (!dismissible) return;
    if (event.target === dialog) {
      close("backdrop");
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="record-sheet"
  aria-labelledby="record-sheet-title"
  on:close={handleClose}
  on:cancel={handleCancel}
  on:click={onBackdropClick}
>
  <section class="record-sheet-panel" aria-labelledby="record-sheet-title">
    <header class="record-sheet-header">
      <div class="flex items-center justify-between gap-4">
        <h2
          id="record-sheet-title"
          class="display text-2xl font-bold tracking-tight text-[var(--fg)]"
        >
          {title}
        </h2>
        <button
          type="button"
          class="focus-ring -mr-2 flex h-11 w-11 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)]"
          aria-label={closeLabel}
          on:click={() => close("close-button")}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {#if description}
        <p class="mt-1 text-sm text-[var(--muted)]">
          {description}
        </p>
      {/if}
    </header>

    <div class="record-sheet-body">
      <slot />
    </div>

    {#if $$slots.footer}
      <footer class="record-sheet-footer">
        <slot name="footer" />
      </footer>
    {/if}
  </section>
</dialog>
