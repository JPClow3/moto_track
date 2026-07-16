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

  // Labels are pt-BR to match the rest of the product; the hrefs are unchanged.
  const nav = [
    { href: '/dashboard', label: 'Painel', icon: 'LayoutDashboard' },
    { href: '/garage', label: 'Garagem', icon: 'Bike' },
    { href: '/fuel', label: 'Combustível', icon: 'Fuel' },
    { href: '/maintenance', label: 'Manutenção', icon: 'Wrench' },
    { href: '/tires', label: 'Pneus', icon: 'CircleGauge' },
    { href: '/documents', label: 'Documentos', icon: 'FileText' },
    { href: '/reminders', label: 'Lembretes', icon: 'Bell' },
    { href: '/expenses', label: 'Despesas', icon: 'ReceiptText' },
    { href: '/reports', label: 'Relatórios', icon: 'ChartNoAxesCombined' },
    { href: '/trabalho', label: 'Trabalho', icon: 'BriefcaseBusiness' },
    { href: '/admin', label: 'Admin', icon: 'Shield' }
  ];
</script>

<div class="min-h-screen bg-[var(--bg)] text-[var(--fg)] relative">
  <!-- Sidebar -->
  <aside class="fixed inset-y-0 left-0 hidden w-72 border-r border-[var(--line)] bg-[var(--panel)] p-4 lg:flex flex-col">
    <a href="/dashboard" class="focus-ring flex items-center gap-3 rounded px-2 py-3 transition hover:opacity-80">
      <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-6 dark:hidden" />
      <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="h-6 hidden dark:block" />
    </a>

    <nav class="mt-8 space-y-0.5 flex-1 overflow-y-auto pr-2">
      {#each nav as item}
        {@const Icon = icons[item.icon as keyof typeof icons]}
        <!-- Inlined rather than a helper: Svelte only re-evaluates template
             expressions that reference currentPath directly. -->
        {@const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`)}
        <a
          class="nav-item focus-ring flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition"
          class:selected={active}
          class:not-selected={!active}
          href={item.href}
          aria-current={active ? 'page' : undefined}
        >
          <Icon size={18} class={active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>

    <div class="mt-4 pt-4 border-t border-[var(--line)]">
      <div class="flex items-center gap-3 px-2 py-2">
         <div class="w-8 h-8 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold text-xs uppercase">
           {user?.email?.charAt(0) ?? 'U'}
         </div>
         <span class="text-xs font-medium text-[var(--muted)] truncate max-w-[180px]">{user?.email ?? 'Conta autenticada'}</span>
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
        <div class="hidden label-tech text-[var(--muted)] lg:block">
           Central da garagem
        </div>
        <div class="flex items-center gap-3">
          <a href="/precos" class="button-secondary text-xs px-3 py-1.5">Planos</a>
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

  .selected::before {
    content: "";
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
</style>
