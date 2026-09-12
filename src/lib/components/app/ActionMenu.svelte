<script context="module" lang="ts">
  export type ActionChoice = {
    id: string;
    label: string;
    description: string;
    recommended?: boolean;
    disabled?: boolean;
  };
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import X from "lucide-svelte/icons/x";

  export let title = "";
  export let closeLabel = "Fechar";
  export let recommendedLabel = "Recomendado";
  export let choices: ActionChoice[] = [];

  const dispatch = createEventDispatcher<{
    select: string;
    close: void;
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

  export function close() {
    if (dialog && dialog.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }

  function handleClose() {
    dispatch("close");
    if (returnFocus && typeof returnFocus.focus === "function") {
      returnFocus.focus();
    }
    returnFocus = null;
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === dialog) {
      close();
    }
  }

  function selectChoice(choice: ActionChoice) {
    if (choice.disabled) return;
    close();
    dispatch("select", choice.id);
  }
</script>

<dialog
  bind:this={dialog}
  class="action-menu-dialog"
  aria-labelledby={title ? "action-menu-title" : undefined}
  aria-modal="true"
  on:close={handleClose}
  on:click={onBackdropClick}
>
  <div class="action-menu-panel">
    {#if title}
      <header
        class="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"
      >
        <h2 id="action-menu-title" class="display text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          class="focus-ring -mr-1 flex h-9 w-9 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)]"
          aria-label={closeLabel}
          on:click={close}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
    {/if}

    <div class="space-y-1 p-2">
      {#each choices as choice (choice.id)}
        <button
          type="button"
          class="action-menu-item focus-ring flex w-full flex-col items-start rounded p-3 text-left transition hover:bg-[var(--panel-sunken)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={choice.disabled}
          on:click={() => selectChoice(choice)}
        >
          <div class="flex w-full items-center justify-between gap-2">
            <span class="text-sm font-semibold text-[var(--fg)]">
              {choice.label}
            </span>
            {#if choice.recommended}
              <span
                class="label-tech rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]"
              >
                {recommendedLabel}
              </span>
            {/if}
          </div>
          {#if choice.description}
            <span class="mt-1 text-xs text-[var(--muted)]">
              {choice.description}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</dialog>
