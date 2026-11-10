<script lang="ts">
  import { createEventDispatcher, type Snippet } from "svelte";
  import X from "lucide-svelte/icons/x";
  import { t } from "$lib/i18n/store";

  // Unique within the rendered tree and stable across SSR and hydration.
  const uid = $props.id();
  let {
    title,
    description = "",
    closeLabel = "",
    dismissible = true,
    titleId = `record-sheet-title-${uid}`,
    children,
    footer,
  }: {
    title: string;
    description?: string;
    closeLabel?: string;
    dismissible?: boolean;
    /** Override the generated ID if you need to reference it externally. */
    titleId?: string;
    children?: Snippet;
    footer?: Snippet;
  } = $props();

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
  aria-labelledby={titleId}
  onclose={handleClose}
  oncancel={handleCancel}
  onclick={onBackdropClick}
>
  <section class="record-sheet-panel" aria-labelledby={titleId}>
    <header class="record-sheet-header">
      <div class="flex items-center justify-between gap-4">
        <h2
          id={titleId}
          class="display text-2xl tracking-tight text-[var(--fg)]"
        >
          {title}
        </h2>
        <button
          type="button"
          class="focus-ring -mr-2 flex h-11 w-11 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)]"
          aria-label={closeLabel || $t("common.close")}
          onclick={() => close("close-button")}
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
      {@render children?.()}
    </div>

    {#if footer}
      <footer class="record-sheet-footer">
        {@render footer()}
      </footer>
    {/if}
  </section>
</dialog>
