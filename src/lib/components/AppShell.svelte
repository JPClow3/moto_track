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

<div class="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
  <aside class="fixed inset-y-0 left-0 hidden w-72 border-r border-[var(--line)] bg-[var(--panel)] p-4 lg:block">
    <a href="/dashboard" class="focus-ring flex items-center gap-3 rounded-md px-2 py-3">
      <span class="grid h-10 w-10 place-items-center rounded-md bg-ink text-white">MT</span>
      <span>
        <strong class="block text-sm">Moto Track</strong>
        <span class="block text-xs text-[var(--muted)]">Ride data command center</span>
      </span>
    </a>

    <nav class="mt-6 space-y-1">
      {#each nav as item}
        {@const Icon = icons[item.icon as keyof typeof icons]}
        <a
          class="focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
          class:selected={currentPath === item.href || currentPath.startsWith(`${item.href}/`)}
          href={item.href}
        >
          <Icon size={18} />
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>
  </aside>

  <div class="lg:pl-72">
    <header class="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/dashboard" class="font-semibold lg:hidden">Moto Track</a>
        <div class="hidden text-sm text-[var(--muted)] lg:block">
          {user?.email ?? 'Authenticated workspace'}
        </div>
        <div class="flex items-center gap-2">
          <a href="/precos" class="button-secondary">Planos</a>
          <form method="POST" action="/auth?/signOut">
            <button class="button-secondary" type="submit" aria-label="Sair">
              <LogOut size={16} />
              <span class="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <slot />
    </main>
  </div>
</div>

<style>
  .selected {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
  }
</style>
