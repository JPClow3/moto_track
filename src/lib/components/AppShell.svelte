<script lang="ts">
  import { page } from "$app/stores";
  import Bell from "lucide-svelte/icons/bell";
  import BriefcaseBusiness from "lucide-svelte/icons/briefcase-business";
  import ChartNoAxesCombined from "lucide-svelte/icons/chart-no-axes-combined";
  import CreditCard from "lucide-svelte/icons/credit-card";
  import Ellipsis from "lucide-svelte/icons/ellipsis";
  import Fuel from "lucide-svelte/icons/fuel";
  import History from "lucide-svelte/icons/history";
  import LogOut from "lucide-svelte/icons/log-out";
  import Plus from "lucide-svelte/icons/plus";
  import ReceiptText from "lucide-svelte/icons/receipt-text";
  import Shield from "lucide-svelte/icons/shield";
  import UserRound from "lucide-svelte/icons/user-round";
  import Warehouse from "lucide-svelte/icons/warehouse";
  import Wrench from "lucide-svelte/icons/wrench";
  import { tick, type Component, type Snippet } from "svelte";
  import { Motorcycle, Tire, VehicleDocument } from "$components/icons";
  import BrandLogo from "$components/ui/BrandLogo.svelte";
  import AccountMenu from "$components/app/AccountMenu.svelte";
  import BikeSwitcher from "$components/app/BikeSwitcher.svelte";
  import BottomSheet from "$components/app/BottomSheet.svelte";
  import { t } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import LocaleSwitcher from "./LocaleSwitcher.svelte";

  // Shape of `locals.user` (see src/app.d.ts) — only the fields this component
  // actually reads, so it never needs to import server-only auth types.
  type ShellUser = { id: string; email?: string | null };
  type ShellBike = {
    id: string;
    name: string;
    brand?: string | null;
    model?: string | null;
  };

  let {
    user = null,
    isStaff = false,
    motorcycles = [],
    activeMotorcycleId = null,
    children,
  }: {
    user?: ShellUser | null;
    /** Gates the Admin item. The page and every action re-check server-side. */
    isStaff?: boolean;
    motorcycles?: ShellBike[];
    activeMotorcycleId?: string | null;
    children: Snippet;
  } = $props();

  // Lucide icons are still Svelte 4 class components; the domain icons are
  // Svelte 5 components with the same props, so accept either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type NavIcon = Component<any> | (new (...args: any[]) => any);

  type NavItem = {
    href: string;
    key: MessageKey;
    icon: NavIcon;
    staffOnly?: boolean;
  };

  // Bike-first: the three places a rider goes daily are primary; everything
  // else is one level down (sidebar groups on desktop, "Mais" on phones).
  const primaryItems: NavItem[] = [
    { href: "/dashboard", key: "shell.bike", icon: Motorcycle },
    { href: "/history", key: "shell.history", icon: History },
    { href: "/reminders", key: "nav.reminders", icon: Bell },
  ];

  const ACCOUNT_HREF = "/billing/conta";

  const secondaryGroups: Array<{ key: MessageKey; items: NavItem[] }> = [
    {
      key: "navGroup.records",
      items: [
        { href: "/garage", key: "nav.garage", icon: Warehouse },
        { href: "/fuel", key: "nav.fuel", icon: Fuel },
        { href: "/maintenance", key: "nav.maintenance", icon: Wrench },
        { href: "/tires", key: "nav.tires", icon: Tire },
        { href: "/documents", key: "nav.documents", icon: VehicleDocument },
        { href: "/expenses", key: "nav.expenses", icon: ReceiptText },
      ],
    },
    {
      key: "navGroup.insights",
      items: [
        { href: "/reports", key: "nav.reports", icon: ChartNoAxesCombined },
        { href: "/trabalho", key: "nav.work", icon: BriefcaseBusiness },
      ],
    },
    {
      key: "navGroup.system",
      items: [
        { href: ACCOUNT_HREF, key: "conta.heading", icon: UserRound },
        { href: "/admin", key: "nav.admin", icon: Shield, staffOnly: true },
      ],
    },
  ];

  const quickLog: Array<{
    href: string;
    key: MessageKey;
    descKey: MessageKey;
    icon: NavIcon;
  }> = [
    {
      href: "/fuel?new=1",
      key: "shell.logFuel",
      descKey: "shell.logFuelDesc",
      icon: Fuel,
    },
    {
      href: "/maintenance?new=1",
      key: "shell.logService",
      descKey: "shell.logServiceDesc",
      icon: Wrench,
    },
    {
      href: "/expenses?new=1",
      key: "shell.logExpense",
      descKey: "shell.logExpenseDesc",
      icon: ReceiptText,
    },
  ];

  const currentPath = $derived($page.url.pathname);

  const visibleGroups = $derived(
    secondaryGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.staffOnly || isStaff),
      }))
      .filter((group) => group.items.length > 0),
  );

  // The "Mais" sheet lists account links in their own block, so the account
  // destination is left out of its section grid (one link per name).
  const moreItems = $derived(
    visibleGroups
      .flatMap((group) => group.items)
      .filter((item) => item.href !== ACCOUNT_HREF),
  );

  const isActive = (href: string, path: string) =>
    path === href || path.startsWith(`${href}/`);

  const inSecondary = $derived(
    visibleGroups.some((group) =>
      group.items.some((item) => isActive(item.href, currentPath)),
    ),
  );

  let sheet = $state<"quick" | "more" | null>(null);
  let quickButton: HTMLButtonElement | undefined = $state();
  let moreButton: HTMLButtonElement | undefined = $state();

  function openSheet(which: "quick" | "more") {
    sheet = sheet === which ? null : which;
  }

  function closeSheet(restoreFocus = true) {
    const which = sheet;
    sheet = null;
    if (!restoreFocus || !which) return;
    void tick().then(() =>
      (which === "more" ? moreButton : quickButton)?.focus(),
    );
  }

  // Close any sheet on navigation, otherwise it stays open over the new page.
  let lastPath = $page.url.pathname;
  $effect(() => {
    const path = currentPath;
    if (path !== lastPath) {
      lastPath = path;
      sheet = null;
    }
  });
</script>

<div class="relative min-h-screen bg-[var(--bg)] text-[var(--fg)]">
  <a href="#main-content" class="skip-link">{$t("a11y.skipToContent")}</a>

  <!-- Sidebar (lg and up) -->
  <aside
    class="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-[var(--line)] bg-[var(--panel)] px-3 py-4 lg:flex"
  >
    <a
      href="/dashboard"
      class="focus-ring flex min-h-11 items-center rounded px-2 transition hover:opacity-80"
    >
      <BrandLogo size={22} />
    </a>

    <nav
      class="mt-6 flex-1 overflow-y-auto pr-1"
      aria-label={$t("nav.primary")}
    >
      <ul class="mb-5 space-y-0.5">
        {#each primaryItems as item (item.href)}
          {@const active = isActive(item.href, currentPath)}
          <li>
            <a
              class="nav-item focus-ring flex min-h-11 items-center gap-3 rounded px-3 text-sm transition"
              class:selected={active}
              class:not-selected={!active}
              href={item.href}
              aria-current={active ? "page" : undefined}
            >
              <item.icon size={20} aria-hidden="true" class="shrink-0" />
              <span>{$t(item.key)}</span>
            </a>
          </li>
        {/each}
      </ul>

      {#each visibleGroups as group (group.key)}
        <div class="mb-5">
          <p class="label-tech px-3 pb-1.5 text-[var(--muted)]">
            {$t(group.key)}
          </p>
          <ul class="space-y-0.5">
            {#each group.items as item (item.href)}
              {@const active = isActive(item.href, currentPath)}
              <li>
                <a
                  class="nav-item focus-ring flex min-h-10 items-center gap-3 rounded px-3 text-sm transition"
                  class:selected={active}
                  class:not-selected={!active}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon size={20} aria-hidden="true" class="shrink-0" />
                  <span>{$t(item.key)}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <div class="mt-2 border-t border-[var(--line)] pt-2">
      <AccountMenu email={user?.email ?? null} />
    </div>
  </aside>

  <!-- Main area -->
  <div class="flex min-h-screen flex-col lg:pl-60">
    <header
      class="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md"
    >
      <div
        class="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6 lg:px-8"
      >
        <a
          href="/dashboard"
          class="focus-ring -ml-1 flex min-h-11 shrink-0 items-center rounded px-1 lg:hidden"
        >
          <BrandLogo size={18} wordmark={false} />
        </a>
        <div class="min-w-0 flex-1">
          <BikeSwitcher {motorcycles} activeId={activeMotorcycleId} />
        </div>
      </div>
    </header>

    <main
      id="main-content"
      class="app-main mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      tabindex="-1"
    >
      {@render children()}
    </main>

    <!-- Thumb-reachable bar on phones: three destinations, quick log, more. -->
    <nav
      class="mobile-bottom-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[var(--line)] lg:hidden"
      aria-label={$t("nav.primary")}
    >
      {#each primaryItems.slice(0, 2) as item (item.href)}
        {@const active = isActive(item.href, currentPath)}
        <a
          class="bar-item focus-ring"
          class:bar-active={active}
          href={item.href}
          aria-current={active ? "page" : undefined}
        >
          <item.icon size={20} aria-hidden="true" />
          <span>{$t(item.key)}</span>
        </a>
      {/each}

      <div class="grid place-items-center">
        <button
          bind:this={quickButton}
          type="button"
          class="quick-log focus-ring grid h-12 w-12 place-items-center rounded-full"
          aria-label={$t("shell.quickLog")}
          aria-haspopup="dialog"
          aria-expanded={sheet === "quick"}
          aria-controls="app-quick-log"
          onclick={() => openSheet("quick")}
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      </div>

      {#each primaryItems.slice(2) as item (item.href)}
        {@const active = isActive(item.href, currentPath)}
        <a
          class="bar-item focus-ring"
          class:bar-active={active}
          href={item.href}
          aria-current={active ? "page" : undefined}
        >
          <item.icon size={20} aria-hidden="true" />
          <span>{$t(item.key)}</span>
        </a>
      {/each}

      <button
        bind:this={moreButton}
        type="button"
        class="bar-item focus-ring"
        class:bar-active={inSecondary || sheet === "more"}
        aria-haspopup="dialog"
        aria-expanded={sheet === "more"}
        aria-controls="app-mobile-nav"
        onclick={() => openSheet("more")}
      >
        <Ellipsis size={20} aria-hidden="true" />
        <span>{$t("shell.more")}</span>
      </button>
    </nav>
  </div>
</div>

{#if sheet === "quick"}
  <BottomSheet
    id="app-quick-log"
    title={$t("shell.quickLogTitle")}
    onclose={() => closeSheet()}
  >
    <ul class="space-y-1">
      {#each quickLog as item (item.href)}
        <li>
          <a
            href={item.href}
            class="focus-ring flex min-h-14 items-center gap-3 rounded px-2 py-2 hover:bg-[var(--accent-wash)]"
            onclick={() => closeSheet(false)}
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded bg-[var(--panel-sunken)] text-[var(--fg)]"
              aria-hidden="true"
            >
              <item.icon size={20} />
            </span>
            <span class="min-w-0">
              <span class="block text-base font-semibold text-[var(--fg)]"
                >{$t(item.key)}</span
              >
              <span class="block text-sm text-[var(--muted)]"
                >{$t(item.descKey)}</span
              >
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </BottomSheet>
{/if}

{#if sheet === "more"}
  <BottomSheet
    id="app-mobile-nav"
    title={$t("shell.moreTitle")}
    onclose={() => closeSheet()}
  >
    <nav aria-label={$t("shell.sections")}>
      <ul class="grid grid-cols-2 gap-1">
        {#each moreItems as item (item.href)}
          {@const active = isActive(item.href, currentPath)}
          <li>
            <a
              class="sheet-item focus-ring flex min-h-12 items-center gap-3 rounded px-2.5 text-sm"
              class:sheet-active={active}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onclick={() => closeSheet(false)}
            >
              <item.icon size={20} aria-hidden="true" class="shrink-0" />
              <span class="min-w-0 truncate">{$t(item.key)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="mt-3 border-t border-[var(--line)] pt-3">
      {#if user?.email}
        <p class="truncate px-2.5 pb-1 text-xs text-[var(--muted)]">
          {user.email}
        </p>
      {/if}
      <ul class="space-y-0.5">
        <li>
          <a
            class="sheet-item focus-ring flex min-h-11 items-center gap-3 rounded px-2.5 text-sm"
            class:sheet-active={isActive(ACCOUNT_HREF, currentPath)}
            href={ACCOUNT_HREF}
            aria-current={isActive(ACCOUNT_HREF, currentPath)
              ? "page"
              : undefined}
            onclick={() => closeSheet(false)}
          >
            <UserRound size={20} aria-hidden="true" class="shrink-0" />
            {$t("conta.heading")}
          </a>
        </li>
        {#if !$page.data?.nativeStore}
          <li>
            <a
              class="sheet-item focus-ring flex min-h-11 items-center gap-3 rounded px-2.5 text-sm"
              href="/precos"
              onclick={() => closeSheet(false)}
            >
              <CreditCard size={20} aria-hidden="true" class="shrink-0" />
              {$t("nav.plans")}
            </a>
          </li>
        {/if}
        <li class="px-1">
          <LocaleSwitcher id="locale-select-mobile" />
        </li>
        <li>
          <form method="POST" action="/auth?/signOut">
            <button
              type="submit"
              class="sheet-item focus-ring flex min-h-11 w-full items-center gap-3 rounded px-2.5 text-left text-sm"
            >
              <LogOut size={20} aria-hidden="true" class="shrink-0" />
              {$t("common.signOut")}
            </button>
          </form>
        </li>
      </ul>
    </div>
  </BottomSheet>
{/if}

<style>
  /* Active route: ink text, ink icon and a 2px ink edge marker. No red in the
     navigation — red is reserved for "your bike needs you". */
  .nav-item {
    position: relative;
  }

  .selected {
    background: var(--accent-wash);
    color: var(--fg);
    font-weight: 600;
  }

  .nav-item.selected::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 2px;
    border-radius: 1px;
    background: var(--fg);
  }

  .not-selected {
    color: var(--muted);
    font-weight: 500;
  }

  .not-selected:hover {
    background: var(--accent-wash);
    color: var(--fg);
  }

  .mobile-bottom-nav {
    background: color-mix(in srgb, var(--panel) 96%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .bar-item {
    position: relative;
    display: flex;
    min-height: 3.5rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem 0.25rem;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 500;
    color: var(--muted);
    transition: color 0.15s;
  }

  .bar-item:hover {
    color: var(--fg);
  }

  .bar-active {
    color: var(--fg);
    font-weight: 600;
  }

  .bar-active::before {
    content: "";
    position: absolute;
    top: 0;
    left: 28%;
    right: 28%;
    height: 2px;
    background: var(--fg);
    border-radius: 9999px;
  }

  .quick-log {
    background: var(--fg);
    color: var(--bg);
    box-shadow: 0 4px 12px rgb(var(--shadow-color) / 0.25);
    transition:
      background 0.15s,
      transform 0.1s;
  }

  .quick-log:hover {
    background: var(--fg-hover);
  }

  .quick-log:active {
    transform: scale(0.96);
  }

  .sheet-item {
    color: var(--fg);
    font-weight: 500;
  }

  .sheet-item:hover {
    background: var(--accent-wash);
  }

  .sheet-active {
    background: var(--accent-wash);
    font-weight: 600;
    box-shadow: inset 2px 0 0 var(--fg);
  }

  .app-main {
    padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
  }

  @media (min-width: 1024px) {
    .app-main {
      padding-bottom: 2rem;
    }
  }
</style>
