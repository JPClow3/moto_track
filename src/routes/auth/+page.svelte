<script lang="ts">
  import { ShieldAlert, KeyRound, Mail, LogIn } from 'lucide-svelte';
  export let data: { redirectTo: string };
  export let form: { message?: string; email?: string } | undefined;
</script>

<svelte:head><title>Entrar · Moto Track</title></svelte:head>

<div class="min-h-screen bg-[var(--bg)] relative overflow-hidden flex items-center justify-center px-4 py-12">
  <!-- Subtle Background Gradients -->
  <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-signal/10 blur-[100px] pointer-events-none z-0"></div>
  <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-moss/10 blur-[100px] pointer-events-none z-0"></div>

  <div class="w-full max-w-[440px] relative z-10">
    <!-- Header -->
    <div class="text-center mb-8">
      <a href="/" class="inline-block transition hover:opacity-80 mb-8">
        <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-8 mx-auto dark:hidden" />
        <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="h-8 mx-auto hidden dark:block" />
      </a>
      <h1 class="text-3xl font-black text-ink dark:text-white">Acesse sua garagem.</h1>
      <p class="mt-3 text-sm text-[var(--muted)]">
        Gerencie histórico, custos, lembretes e revisões em um só lugar.
      </p>
    </div>

    <!-- Auth Card -->
    <div class="panel p-6 sm:p-8 shadow-2xl bg-[var(--bg)]/60 backdrop-blur-xl border border-[var(--line)] rounded-2xl relative overflow-hidden">
      <!-- Glow effect inside card -->
      <div class="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-signal to-moss"></div>

      {#if form?.message}
        <div class="mb-6 flex items-start gap-3 rounded-lg bg-signal/15 p-4 text-sm text-ink dark:text-white border border-signal/30">
          <ShieldAlert class="w-5 h-5 text-signal shrink-0" />
          <p>{form.message}</p>
        </div>
      {/if}
      
      <form class="grid gap-5" method="POST" action="?/signIn">
        <input type="hidden" name="redirectTo" value={data.redirectTo} />
        
        <div class="grid gap-1.5">
          <label for="email" class="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Email</label>
          <div class="relative">
            <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input id="email" class="field pl-9" name="email" type="email" value={form?.email ?? ''} placeholder="voce@exemplo.com" required />
          </div>
        </div>
        
        <div class="grid gap-1.5">
          <label for="password" class="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Senha</label>
          <div class="relative">
            <KeyRound class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input id="password" class="field pl-9" name="password" type="password" placeholder="••••••••" required />
          </div>
        </div>
        
        <button class="button-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2 text-base shadow-lg shadow-ink/10" type="submit">
          <LogIn class="w-4 h-4" />
          Entrar
        </button>
      </form>
      
      <div class="relative my-8">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-[var(--line)]"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="bg-[var(--panel)] px-4 text-[var(--muted)]">ou continuar com</span>
        </div>
      </div>
      
      <form method="POST" action="?/google">
        <button class="button-secondary w-full py-2.5 flex items-center justify-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors" type="submit">
          <svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
          Google
        </button>
      </form>
      
      <details class="group mt-8 rounded-xl border border-[var(--line)] bg-[var(--bg)]/30 p-1 [&_summary::-webkit-details-marker]:hidden">
        <summary class="cursor-pointer text-sm font-semibold text-center p-3 hover:text-signal transition-colors flex items-center justify-center gap-2">
          Criar conta ou recuperar senha
          <svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="p-4 border-t border-[var(--line)] grid gap-6">
          <form class="grid gap-3" method="POST" action="?/signUp">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">Nova Conta</h3>
            <input class="field" name="email" type="email" placeholder="email@exemplo.com" required />
            <input class="field" name="password" type="password" placeholder="senha (mínimo 6 caracteres)" required />
            <button class="button-secondary" type="submit">Criar conta</button>
          </form>
          <div class="border-t border-[var(--line)]"></div>
          <form class="grid gap-3" method="POST" action="?/resetPassword">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">Esqueci a Senha</h3>
            <input class="field" name="email" type="email" placeholder="email@exemplo.com" required />
            <button class="button-secondary" type="submit">Enviar link de recuperação</button>
          </form>
        </div>
      </details>
    </div>
  </div>
</div>
