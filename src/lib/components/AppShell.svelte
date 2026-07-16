<script lang="ts">
  import {
    Bell,
    Bike,
    BriefcaseBusiness,
    ChartNoAxesCombined,
    FileText,
    Fuel,
    LayoutDashboard,
    LogOut,
    Menu,
    ReceiptText,
    Shield,
    Wrench,
    CircleGauge,
    X
  } from 'lucide-svelte';
  import type { User } from '@supabase/supabase-js';
  import { t } from '$lib/i18n/store';
  import type { MessageKey } from '$lib/i18n';
  import LocaleSwitcher from './LocaleSwitcher.svelte';

  export let user: User | null = null;
  export let currentPath = '/dashboard';
  /** Gates the Admin item. The page and every action re-check server-side. */
  export let isStaff = false;

  const icons = {
    LayoutDashboard,
    Bike,
    Fuel,
    Wrench,
    CircleGauge,
    FileText,
    Bell,
    ReceiptText,
    ChartNoAxesCombined,
    BriefcaseBusiness,
    Shield
  };

  type NavItem = {
    href: string;
    key: MessageKey;
    icon: keyof typeof icons;
    staffOnly?: boolean;
    /** Shown in the compact mobile bar — the full list doesn't fit. */
    primary?: boolean;
  };

  // Grouped so the sidebar reads as a hierarchy instead of eleven equal-weight
  // links. "Everything is top-level" was the main reason the nav felt cluttered.
  const groups: Array<{ key: MessageKey | null; items: NavItem[] }> = [
    {
      key: null,
      items: [{ href: '/dashboard', key: 'nav.dashboard', icon: 'LayoutDashboard', primary: true }]
    },
    {
      key: 'navGroup.garage',
      items: [
        { href: '/garage', key: 'nav.garage', icon: 'Bike', primary: true },
        { href: '/fuel', key: 'nav.fuel', icon: 'Fuel', primary: true },
        { href: '/maintenance', key: 'nav.maintenance', icon: 'Wrench', primary: true },
        { href: '/tires', key: 'nav.tires', icon: 'CircleGauge' }
      ]
    },
    {
      key: 'navGroup.records',
      items: [
        { href: '/documents', key: 'nav.documents', icon: 'FileText' },
        { href: '/reminders', key: 'nav.reminders', icon: 'Bell' },
        { href: '/expenses', key: 'nav.expenses', icon: 'ReceiptText' }
      ]
    },
    {
      key: 'navGroup.insights',
      items: [
        { href: '/reports', key: 'nav.reports', icon: 'ChartNoAxesCombined' },
        { href: '/trabalho', key: 'nav.work', icon: 'BriefcaseBusiness' }
      ]
    },
    {
      key: 'navGroup.system',
      items: [{ href: '/admin', key: 'nav.admin', icon: 'Shield', staffOnly: true }]
    }
  ];

  let mobileOpen = false;

  $: visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.staffOnly || isStaff) }))
    .filter((group) => group.items.length > 0);

  const mobileItems = groups.flatMap((group) => group.items.filter((item) => item.primary));

  const isActive = (href: string, path: string) => path === href || path.startsWith(`${href}/`);

  // Close the drawer on navigation, otherwise it stays open over the new page.
  $: if (currentPath) mobileOpen = false;
</script>

<div class="relative min-h-screen bg-[var(--bg)] text-[var(--fg)]">
  <a href="#main-content" class="skip-link">{$t('a11y.skipToContent')}</a>

  <!-- Sidebar (lg and up) -->
  <aside
    class="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-[var(--line)] bg-[var(--panel)] p-4 lg:flex"
  >
    <a href="/dashboard" class="focus-ring flex items-center gap-3 rounded px-2 py-3 transition hover:opacity-80">
      <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-6 dark:hidden" />
      <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="hidden h-6 dark:block" />
    </a>

    <nav class="mt-8 flex-1 overflow-y-auto pr-2" aria-label={$t('nav.primary')}>
      {#each visibleGroups as group (group.key ?? 'root')}
        <div class="mb-5">
          {#if group.key}
            <p class="label-tech px-3 pb-2 text-[10px] text-[var(--muted)]">{$t(group.key)}</p>
          {/if}
          <ul class="space-y-0.5">
            {#each group.items as item (item.href)}
              {@const Icon = icons[item.icon]}
              {@const active = isActive(item.href, currentPath)}
              <li>
                <a
                  class="nav-item focus-ring flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition"
                  class:selected={active}
                  class:not-selected={!active}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} class={active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
                  <span>{$t(item.key)}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <div class="mt-4 border-t border-[var(--line)] pt-4">
      <div class="flex items-center gap-3 px-2 py-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--accent-soft)] text-xs font-bold uppercase text-[var(--accent)]"
          aria-hidden="true"
        >
          {user?.email?.charAt(0) ?? 'U'}
        </div>
        <span class="max-w-[180px] truncate text-xs font-medium text-[var(--muted)]">
          {user?.email ?? $t('common.account')}
        </span>
      </div>
      <div class="px-2 pt-1">
        <LocaleSwitcher />
      </div>
    </div>
  </aside>

  <!-- Main area -->
  <div class="flex min-h-screen flex-col lg:pl-72">
    <header class="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div class="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          class="focus-ring -ml-2 grid h-10 w-10 place-items-center rounded lg:hidden"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="app-mobile-nav"
          aria-label={mobileOpen ? $t('nav.closeMenu') : $t('nav.openMenu')}
          on:click={() => (mobileOpen = !mobileOpen)}
        >
          {#if mobileOpen}<X size={18} />{:else}<Menu size={18} />{/if}
        </button>

        <a href="/dashboard" class="flex items-center font-semibold lg:hidden">
          <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-5 dark:hidden" />
          <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="hidden h-5 dark:block" />
        </a>

        <p class="label-tech hidden text-[var(--muted)] lg:block">{$t('nav.tagline')}</p>

        <div class="flex items-center gap-3">
          <a href="/precos" class="button-secondary px-3 py-1.5 text-xs">{$t('nav.plans')}</a>
          <form method="POST" action="/auth?/signOut">
            <button class="button-secondary px-3 py-1.5 text-xs" type="submit">
              <LogOut size={14} aria-hidden="true" />
              <span class="hidden sm:inline">{$t('common.signOut')}</span>
              <span class="sr-only sm:hidden">{$t('common.signOut')}</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Mobile drawer. Before this the sidebar was `hidden lg:flex` with
           nothing replacing it, so a phone had no way to reach any section. -->
      {#if mobileOpen}
        <nav
          id="app-mobile-nav"
          class="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-2 lg:hidden"
          aria-label={$t('nav.primary')}
        >
          {#each visibleGroups as group (group.key ?? 'root')}
            <ul>
              {#each group.items as item (item.href)}
                {@const Icon = icons[item.icon]}
                {@const active = isActive(item.href, currentPath)}
                <li>
                  <a
                    class="focus-ring flex items-center gap-3 rounded px-2 py-3 text-sm font-medium"
                    class:selected={active}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={18} class={active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
                    <span>{$t(item.key)}</span>
                  </a>
                </li>
              {/each}
            </ul>
          {/each}
          <div class="border-t border-[var(--line)] px-2 py-3">
            <LocaleSwitcher id="locale-select-mobile" />
          </div>
        </nav>
      {/if}
    </header>

    <main id="main-content" class="mx-auto w-full max-w-7xl flex-1 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:pb-8">
      <slot />
    </main>

    <!-- Thumb-reachable bar for the most-used sections on phones. -->
    <nav
      class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur-md lg:hidden"
      aria-label={$t('nav.primary')}
    >
      {#each mobileItems.slice(0, 4) as item (item.href)}
        {@const Icon = icons[item.icon]}
        {@const active = isActive(item.href, currentPath)}
        <a
          class="focus-ring flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition"
          class:bar-active={active}
          class:bar-idle={!active}
          href={item.href}
          aria-current={active ? 'page' : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{$t(item.key)}</span>
        </a>
      {/each}
    </nav>
  </div>
</div>

<style>
  /* Active route reads as a red edge marker on the rail rather than a wash of
     colour — keeps red rare and scans quickly down the list. */
  .nav-item {
    position: relative;
  }

  .selected {
    background: var(--accent-soft);
    color: var(--fg);
    font-weight: 600;
  }

  .nav-item.selected::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 2px;
    background: var(--accent);
  }

  .not-selected {
    color: var(--muted);
  }

  .not-selected:hover {
    background: color-mix(in srgb, var(--fg) 4%, transparent);
    color: var(--fg);
  }

  .bar-active {
    color: var(--accent);
  }

  .bar-idle {
    color: var(--muted);
  }
</style>
