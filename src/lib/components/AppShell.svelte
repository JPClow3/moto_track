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
    ReceiptText,
    Settings,
    Shield,
    Wrench,
    CircleGauge
  } from 'lucide-svelte';
  import type { User } from '@supabase/supabase-js';

  export let user: User | null = null;
  export let currentPath = '/dashboard';

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
    Settings,
    Shield
  };

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/garage', label: 'Garage', icon: 'Bike' },
    { href: '/fuel', label: 'Fuel', icon: 'Fuel' },
    { href: '/maintenance', label: 'Maintenance', icon: 'Wrench' },
    { href: '/tires', label: 'Tires', icon: 'CircleGauge' },
    { href: '/documents', label: 'Documents', icon: 'FileText' },
    { href: '/reminders', label: 'Reminders', icon: 'Bell' },
    { href: '/expenses', label: 'Expenses', icon: 'ReceiptText' },
    { href: '/reports', label: 'Reports', icon: 'ChartNoAxesCombined' },
    { href: '/trabalho', label: 'Work', icon: 'BriefcaseBusiness' },
    { href: '/admin', label: 'Admin', icon: 'Shield' }
  ];
</script>

<div class="min-h-screen bg-[var(--bg)] text-[var(--fg)] relative">
  <!-- Sidebar -->
  <aside class="fixed inset-y-0 left-0 hidden w-72 border-r border-[var(--line)] bg-[var(--panel)] p-4 lg:flex flex-col">
    <a href="/dashboard" class="focus-ring flex items-center gap-3 rounded-md px-2 py-3 transition hover:opacity-80">
      <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-6 dark:hidden" />
      <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="h-6 hidden dark:block" />
    </a>

    <nav class="mt-8 space-y-1.5 flex-1 overflow-y-auto pr-2">
      {#each nav as item}
        {@const Icon = icons[item.icon as keyof typeof icons]}
        <a
          class="focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition"
          class:selected={currentPath === item.href || currentPath.startsWith(`${item.href}/`)}
          class:not-selected={currentPath !== item.href && !currentPath.startsWith(`${item.href}/`)}
          href={item.href}
        >
          <Icon size={18} class={currentPath === item.href || currentPath.startsWith(`${item.href}/`) ? 'text-signal' : 'text-[var(--muted)]'} />
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>
    
    <div class="mt-4 pt-4 border-t border-[var(--line)]">
      <div class="flex items-center gap-3 px-2 py-2">
         <div class="w-8 h-8 rounded-full bg-signal/20 text-signal flex items-center justify-center font-bold text-xs uppercase">
           {user?.email?.charAt(0) ?? 'U'}
         </div>
         <span class="text-xs font-medium text-[var(--muted)] truncate max-w-[180px]">{user?.email ?? 'Authenticated'}</span>
      </div>
    </div>
  </aside>

  <!-- Main Area -->
  <div class="lg:pl-72 flex flex-col min-h-screen">
    <header class="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div class="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="/dashboard" class="font-semibold lg:hidden flex items-center transition hover:opacity-80">
          <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-5 dark:hidden" />
          <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="h-5 hidden dark:block" />
        </a>
        <div class="hidden text-sm font-medium text-[var(--muted)] lg:block">
           Workspace Overview
        </div>
        <div class="flex items-center gap-3">
          <a href="/precos" class="button-secondary text-xs px-3 py-1.5 border-[var(--line)] hover:border-signal/50 hover:text-signal transition-colors">Planos</a>
          <form method="POST" action="/auth?/signOut">
            <button class="button-secondary text-xs px-3 py-1.5" type="submit" aria-label="Sair">
              <LogOut size={14} />
              <span class="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </div>
    </header>

    <main class="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</div>

<style>
  .selected {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--fg);
  }
  .not-selected {
    color: var(--muted);
  }
  .not-selected:hover {
    background: color-mix(in srgb, var(--fg) 4%, transparent);
    color: var(--fg);
  }
</style>
