<script lang="ts">
  import X from "lucide-svelte/icons/x";
  import { onMount, type Snippet } from "svelte";
  import { t } from "$lib/i18n/store";

  // Phone-only sheet for the shell (quick log, "Mais"). The parent renders it
  // only while open, so closing removes it from the DOM; the parent also owns
  // returning focus to whichever bar button opened it.
  let {
    id,
    title,
    onclose,
    children,
  }: {
    id: string;
    title: string;
    onclose: () => void;
    children: Snippet;
  } = $props();

  let panel: HTMLElement;
  const titleId = $derived(`${id}-title`);
  const FOCUSABLE =
    "a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex='-1'])";

  function focusable() {
    return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
  }

  onMount(() => {
    focusable()[0]?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const outside = !active || !panel.contains(active);
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Click-away backdrop: not keyboard reachable and redundant with the close
     button + Escape, so it stays out of the accessibility tree. -->
<button
  type="button"
  class="sheet-backdrop fixed inset-0 z-40 cursor-default border-0 lg:hidden"
  onclick={onclose}
  aria-hidden="true"
  tabindex="-1"
></button>

<div
  bind:this={panel}
  {id}
  class="shell-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col border-t border-[var(--line)] bg-[var(--panel)] lg:hidden"
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
>
  <div class="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
    <h2 id={titleId} class="display text-xl text-[var(--fg)]">{title}</h2>
    <button
      type="button"
      class="focus-ring -mr-2 grid h-11 w-11 place-items-center rounded text-[var(--muted)] hover:text-[var(--fg)]"
      aria-label={$t("common.close")}
      onclick={onclose}
    >
      <X size={20} aria-hidden="true" />
    </button>
  </div>
  <div class="overflow-y-auto px-4 pb-4">
    {@render children()}
  </div>
</div>

<style>
  .sheet-backdrop {
    background: rgb(0 0 0 / 0.45);
  }

  .shell-sheet {
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
    box-shadow: 0 -8px 32px rgb(var(--shadow-color) / 0.3);
    padding-bottom: env(safe-area-inset-bottom);
    animation: sheet-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes sheet-in {
    from {
      transform: translateY(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shell-sheet {
      animation: none;
    }
  }
</style>
