<script lang="ts">
  import { t } from "$lib/i18n/store";

  /**
   * A styled replacement for window.confirm().
   *
   * Built on the native <dialog> rather than a hand-rolled overlay: the browser
   * gives us the focus trap, Escape-to-dismiss, inertness of the background and
   * correct aria-modal semantics for free. Those are exactly the parts a custom
   * modal usually gets wrong, and getting them wrong would make this *less*
   * accessible than the confirm() it replaces.
   *
   * Usage:
   *   <ConfirmDialog bind:this={dialog} />
   *   if (await dialog.ask('Delete this?')) { ... }
   */
  let dialog: HTMLDialogElement;
  let resolve: ((confirmed: boolean) => void) | null = null;

  let message = "";
  export let title = "";
  export let confirmLabel = "";
  export let destructive = true;

  export function ask(text: string): Promise<boolean> {
    message = text;
    dialog.showModal();
    return new Promise<boolean>((res) => (resolve = res));
  }

  // Every exit routes through <dialog>'s close event — the buttons, Escape and
  // the backdrop alike — so there is exactly one place that settles the promise
  // and it can never be left dangling.
  function settle(confirmed: boolean) {
    const pending = resolve;
    resolve = null;
    pending?.(confirmed);
  }

  function onBackdropClick(event: MouseEvent) {
    // A click landing on <dialog> itself is the backdrop: the panel inside
    // stops anything within it from reaching here.
    if (event.target === dialog) dialog.close("cancel");
  }
</script>

<dialog
  bind:this={dialog}
  class="confirm-dialog"
  aria-labelledby="confirm-title"
  on:close={() => settle(dialog.returnValue === "confirm")}
  on:click={onBackdropClick}
>
  <div class="p-6">
    <h2 class="display text-2xl" id="confirm-title">
      {title || $t("common.confirmTitle")}
    </h2>
    <p class="mt-2 text-sm text-[var(--muted)]">{message}</p>

    <!-- method="dialog" closes the dialog and sets returnValue to the button's
         value, with no JS and no submit handler. -->
    <form method="dialog" class="mt-7 flex justify-end gap-2">
      <button class="button-secondary" value="cancel"
        >{$t("common.cancel")}</button
      >
      <button
        class={destructive ? "button-danger" : "button-primary"}
        value="confirm"
        data-autofocus
      >
        {confirmLabel || $t("common.confirm")}
      </button>
    </form>
  </div>
</dialog>

<style>
  .confirm-dialog {
    width: min(28rem, calc(100vw - 2rem));
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--panel);
    color: var(--fg);
    box-shadow: 0 24px 48px -12px rgb(var(--shadow-color) / 0.35);
  }

  .confirm-dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
    backdrop-filter: blur(2px);
  }

  .confirm-dialog[open] {
    animation: confirm-in 0.16s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes confirm-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .confirm-dialog[open] {
      animation: none;
    }
  }
</style>
