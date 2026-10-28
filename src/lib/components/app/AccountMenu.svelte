<script lang="ts">
  import { page } from "$app/stores";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CreditCard from "lucide-svelte/icons/credit-card";
  import LogOut from "lucide-svelte/icons/log-out";
  import UserRound from "lucide-svelte/icons/user-round";
  import { t } from "$lib/i18n/store";
  import LocaleSwitcher from "$components/LocaleSwitcher.svelte";

  // Desktop sidebar footer. The phone shell shows the same items inside the
  // "Mais" sheet instead, so this only renders from `lg` up.
  let { email = null }: { email?: string | null } = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  const panelId = "account-menu-panel";

  const isActive = (href: string) =>
    $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`);

  function close(restoreFocus = false) {
    open = false;
    if (restoreFocus) trigger?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }

  function onDocumentClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) close();
  }

  function onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (open && next && root && !root.contains(next)) close();
  }

  const itemClass =
    "focus-ring flex min-h-11 w-full items-center gap-3 rounded px-2.5 text-sm font-medium text-[var(--fg)] hover:bg-[var(--accent-wash)]";
</script>

<svelte:window onkeydown={onKeydown} onclick={onDocumentClick} />

<div class="relative" bind:this={root} onfocusout={onFocusOut}>
  <button
    bind:this={trigger}
    type="button"
    class="focus-ring flex min-h-11 w-full items-center gap-3 rounded px-2 py-2 text-left transition hover:bg-[var(--accent-wash)]"
    aria-expanded={open}
    aria-controls={panelId}
    title={email ?? undefined}
    onclick={() => (open = !open)}
  >
    <span
      class="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--panel-sunken)] text-xs font-bold uppercase text-[var(--muted)] ring-1 ring-[var(--line)]"
      aria-hidden="true"
    >
      {email?.charAt(0) ?? "U"}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-xs text-[var(--muted)]"
        >{$t("shell.account")}</span
      >
      <span class="block truncate text-sm font-medium text-[var(--fg)]">
        {email ?? $t("shell.account")}
      </span>
    </span>
    <ChevronsUpDown
      size={16}
      class="shrink-0 text-[var(--muted)]"
      aria-hidden="true"
    />
  </button>

  <!-- After the trigger in DOM order so Tab moves into the panel; it is
       positioned above the trigger because the trigger sits at the bottom. -->
  {#if open}
    <div
      id={panelId}
      role="group"
      aria-label={$t("shell.accountMenu")}
      class="absolute inset-x-0 bottom-full z-40 mb-1 rounded-md border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-lift"
    >
      <a
        href="/billing/conta"
        class={itemClass}
        aria-current={isActive("/billing/conta") ? "page" : undefined}
        onclick={() => close()}
      >
        <UserRound size={16} class="text-[var(--muted)]" aria-hidden="true" />
        {$t("conta.heading")}
      </a>
      {#if !$page.data?.nativeStore}
        <a
          href="/precos"
          class={itemClass}
          aria-current={isActive("/precos") ? "page" : undefined}
          onclick={() => close()}
        >
          <CreditCard
            size={16}
            class="text-[var(--muted)]"
            aria-hidden="true"
          />
          {$t("nav.plans")}
        </a>
      {/if}
      <div class="px-0.5">
        <LocaleSwitcher id="locale-select-account" />
      </div>
      <form
        method="POST"
        action="/auth?/signOut"
        class="mt-1 border-t border-[var(--line)] pt-1"
      >
        <button type="submit" class={itemClass}>
          <LogOut size={16} class="text-[var(--muted)]" aria-hidden="true" />
          {$t("common.signOut")}
        </button>
      </form>
    </div>
  {/if}
</div>
