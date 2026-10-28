<script lang="ts">
  import X from "lucide-svelte/icons/x";
  import { t } from "$lib/i18n/store";
  import { dismissToast, toasts } from "./toast";
</script>

<!-- Always mounted so screen readers register the live region before the
     first message arrives. A bare aria-live region rather than role="status":
     pages keep their own status regions for inline feedback, and a second,
     always-present status role made those ambiguous. -->
<div class="toast-region" aria-live="polite" aria-atomic="false">
  {#each $toasts as toast (toast.id)}
    <div class="toast" data-tone={toast.tone}>
      <span class="bar" aria-hidden="true"></span>
      <p class="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
      {#if toast.action?.href}
        <a
          class="focus-ring rounded px-2 py-1 text-sm font-semibold underline-offset-4 hover:underline"
          href={toast.action.href}
          onclick={() => dismissToast(toast.id)}>{toast.action.label}</a
        >
      {:else if toast.action}
        <button
          type="button"
          class="focus-ring rounded px-2 py-1 text-sm font-semibold underline-offset-4 hover:underline"
          onclick={() => {
            toast.action?.onClick?.();
            dismissToast(toast.id);
          }}>{toast.action.label}</button
        >
      {/if}
      <button
        type="button"
        class="focus-ring grid h-8 w-8 place-items-center rounded opacity-70 hover:opacity-100"
        aria-label={$t("common.close")}
        onclick={() => dismissToast(toast.id)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-region {
    position: fixed;
    z-index: 60;
    left: 50%;
    bottom: calc(5rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: grid;
    gap: 0.5rem;
    width: min(28rem, calc(100vw - 2rem));
    pointer-events: none;
  }

  @media (min-width: 1024px) {
    .toast-region {
      left: auto;
      right: 1.5rem;
      bottom: 1.5rem;
      transform: none;
    }
  }

  /* Always dark, in both themes, so it reads as an overlay message rather
     than another card. */
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem 0.5rem 0;
    overflow: hidden;
    border-radius: 6px;
    background: #27272a;
    color: #fafafa;
    box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.35);
    animation: toast-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .toast a,
  .toast button {
    color: inherit;
  }

  .bar {
    align-self: stretch;
    width: 4px;
    margin-right: 0.5rem;
    background: #4ade80;
  }

  [data-tone="info"] .bar {
    background: #86a8f0;
  }

  [data-tone="error"] .bar {
    background: #f87171;
  }

  @keyframes toast-in {
    from {
      transform: translateY(8px);
    }
    to {
      transform: none;
    }
  }
</style>
