<script lang="ts">
  import { page } from "$app/stores";
  import { LayoutDashboard, Menu, X } from "lucide-svelte";
  import { t } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import LocaleSwitcher from "./LocaleSwitcher.svelte";

  const links: Array<{ href: string; key: MessageKey }> = [
    { href: "/precos", key: "nav.plans" },
    { href: "/roadmap", key: "nav.roadmap" },
    { href: "/blog", key: "nav.blog" },
  ];

  // Below `sm` these links were display:none with nothing replacing them, so a
  // phone could only ever reach /auth from the header.
  let open = $state(false);

  // /precos renders in the (public) group, so a signed-in visitor used to land
  // here and see only "Entrar" — no way back to their garage. The session now
  // comes from the root layout load, so the header can offer the way back.
  const user = $derived(
    ($page.data as { user?: { email: string | null } | null }).user ?? null,
  );

  const isActive = (href: string, pathname: string) =>
    pathname.startsWith(href);

  let menuButton: HTMLButtonElement;

  function focusMenuEntry() {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLAnchorElement>("#mobile-nav a")?.focus();
    });
  }

  function openMenu() {
    open = true;
    focusMenuEntry();
  }

  function closeMenu() {
    open = false;
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => menuButton?.focus());
  }

  function toggleMenu() {
    if (open) closeMenu();
    else openMenu();
  }

  $effect(() => {
    if (typeof document === "undefined" || !open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
    };
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  });
</script>

<header
  class="bg-[var(--bg)]/80 sticky top-0 z-50 border-b border-[var(--line)] backdrop-blur-md"
>
  <nav
    class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
    aria-label={$t("nav.primary")}
  >
    <a
      href={user ? "/dashboard" : "/"}
      class="focus-ring inline-flex min-h-11 items-center rounded transition hover:opacity-70"
    >
      <img
        src="/brand/svg/moto-track-logo-horizontal-light.svg"
        alt="Moto Track"
        class="h-7 w-auto dark:hidden"
        width="845"
        height="160"
      />
      <img
        src="/brand/svg/moto-track-logo-horizontal-dark.svg"
        alt="Moto Track"
        class="hidden h-7 w-auto dark:block"
        width="845"
        height="160"
      />
    </a>

    <div class="flex items-center gap-2 sm:gap-6">
      {#each links as link (link.href)}
        <a
          class="focus-ring nav-link label-tech hidden min-h-11 items-center sm:inline-flex"
          class:is-active={isActive(link.href, $page.url.pathname)}
          href={link.href}
          aria-current={isActive(link.href, $page.url.pathname)
            ? "page"
            : undefined}
        >
          {$t(link.key)}
        </a>
      {/each}

      <div class="hidden sm:block"><LocaleSwitcher /></div>
      <!-- id defaults to "locale-select" above; the drawer copy below needs its own. -->

      {#if user}
        <a class="button-primary" href="/dashboard">
          <LayoutDashboard size={14} aria-hidden="true" />
          {$t("nav.dashboard")}
        </a>
      {:else}
        <a class="button-primary" href="/auth">{$t("common.signIn")}</a>
      {/if}

      <button
        bind:this={menuButton}
        class="focus-ring -mr-2 grid h-11 w-11 place-items-center rounded sm:hidden"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? $t("nav.closeMenu") : $t("nav.openMenu")}
        onclick={toggleMenu}
      >
        {#if open}
          <X class="h-5 w-5" />
        {:else}
          <Menu class="h-5 w-5" />
        {/if}
      </button>
    </div>
  </nav>

  {#if open}
    <button
      type="button"
      class="fixed inset-0 top-[65px] z-40 cursor-default border-0 bg-black/40 backdrop-blur-sm sm:hidden"
      onclick={closeMenu}
      aria-label={$t("nav.closeMenu")}
      tabindex="-1"
    ></button>
    <div
      id="mobile-nav"
      class="relative z-50 border-t border-[var(--line)] bg-[var(--bg)] px-6 py-1 shadow-lift sm:hidden"
    >
      {#each links as link (link.href)}
        <a
          class="label-tech block border-b border-[var(--line)] py-4 transition-colors hover:text-[var(--accent)]"
          class:is-current={isActive(link.href, $page.url.pathname)}
          href={link.href}
          aria-current={isActive(link.href, $page.url.pathname)
            ? "page"
            : undefined}
          onclick={closeMenu}
        >
          {$t(link.key)}
        </a>
      {/each}
      <div class="py-3"><LocaleSwitcher id="locale-select-mobile" /></div>
    </div>
  {/if}
</header>

<style>
  /* .nav-link's underline wipes in on hover; on the current page it stays put. */
  .is-active {
    color: var(--accent);
  }
  .is-active::after {
    transform: scaleX(1);
  }

  .is-current {
    color: var(--accent);
  }
</style>
