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
  const user = $derived(($page.data as { user?: { email: string | null } | null }).user ?? null);

  const isActive = (href: string, pathname: string) => pathname.startsWith(href);
</script>

<header class="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-md">
  <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4" aria-label={$t('nav.primary')}>
    <a href={user ? '/dashboard' : '/'} class="focus-ring rounded transition hover:opacity-70">
      <img
        src="/brand/svg/moto-track-logo-horizontal-light.svg"
        alt="Moto Track"
        class="h-7 dark:hidden"
        width="845"
        height="160"
      />
      <img
        src="/brand/svg/moto-track-logo-horizontal-dark.svg"
        alt="Moto Track"
        class="hidden h-7 dark:block"
        width="845"
        height="160"
      />
    </a>

    <div class="flex items-center gap-2 sm:gap-6">
      {#each links as link (link.href)}
        <a
          class="nav-link label-tech hidden sm:inline-block"
          class:is-active={isActive(link.href, $page.url.pathname)}
          href={link.href}
          aria-current={isActive(link.href, $page.url.pathname) ? "page" : undefined}
        >
          {$t(link.key)}
        </a>
      {/each}

      <div class="hidden sm:block"><LocaleSwitcher /></div>
      <!-- id defaults to "locale-select" above; the drawer copy below needs its own. -->

      {#if user}
        <a class="button-primary" href="/dashboard">
          <LayoutDashboard size={14} aria-hidden="true" />
          {$t('nav.dashboard')}
        </a>
      {:else}
        <a class="button-primary" href="/auth">{$t('common.signIn')}</a>
      {/if}

      <button
        class="focus-ring -mr-2 grid h-10 w-10 place-items-center rounded sm:hidden"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? $t('nav.closeMenu') : $t('nav.openMenu')}
        onclick={() => (open = !open)}
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
    <div id="mobile-nav" class="border-t border-[var(--line)] bg-[var(--bg)] px-6 py-1 sm:hidden">
      {#each links as link (link.href)}
        <a
          class="label-tech block border-b border-[var(--line)] py-4"
          class:is-current={isActive(link.href, $page.url.pathname)}
          href={link.href}
          aria-current={isActive(link.href, $page.url.pathname) ? "page" : undefined}
          onclick={() => (open = false)}
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
