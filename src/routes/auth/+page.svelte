<script lang="ts">
  import { ShieldAlert, KeyRound, Mail, LogIn, UserPlus } from "lucide-svelte";

  let {
    data,
    form,
  }: {
    data: { redirectTo: string; message?: string };
    form: { message?: string; email?: string } | undefined;
  } = $props();

  let mode = $state<"signIn" | "signUp">("signIn");
  let showReset = $state(false);
</script>

<svelte:head><title>Entrar · Moto Track</title></svelte:head>

<div
  class="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
>
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow page-glow" aria-hidden="true"></div>

  <div class="relative w-full max-w-[440px]">
    <div class="mb-8 text-center">
      <a
        href="/"
        class="focus-ring mb-8 inline-flex min-h-11 items-center rounded transition hover:opacity-70"
      >
        <img
          src="/brand/svg/moto-track-logo-horizontal-light.svg"
          alt="Moto Track"
          class="mx-auto h-8 dark:hidden"
        />
        <img
          src="/brand/svg/moto-track-logo-horizontal-dark.svg"
          alt="Moto Track"
          class="mx-auto hidden h-8 dark:block"
        />
      </a>
      <h1 class="display text-4xl">Acesse sua garagem.</h1>
      <p class="mt-3 text-sm text-[var(--muted)]">
        Histórico, custos, lembretes e revisões em um só lugar.
      </p>
    </div>

    <div class="panel relative overflow-hidden p-6 shadow-lift sm:p-8">
      {#if form?.message}
        <!-- Errors use the danger token, not the accent. -->
        <div
          class="mb-6 flex items-start gap-3 rounded border border-danger/30 bg-danger/10 p-4 text-sm"
          role="alert"
          aria-live="assertive"
          tabindex="-1"
        >
          <ShieldAlert class="h-5 w-5 shrink-0 text-danger" />
          <p>{form.message}</p>
        </div>
      {:else if data.message}
        <div
          class="mb-6 rounded border border-success/30 bg-success/10 p-4 text-sm text-success"
          role="status"
          aria-live="polite"
          tabindex="-1"
        >
          <p>{data.message}</p>
        </div>
      {/if}

      <div
        class="mb-6 grid grid-cols-2 gap-1 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-1"
        role="tablist"
        aria-label="Modo de acesso"
      >
        <button
          type="button"
          role="tab"
          id="auth-tab-sign-in"
          aria-selected={mode === "signIn"}
          aria-controls="auth-sign-in"
          class="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition {mode ===
          'signIn'
            ? 'bg-[var(--accent-solid)] text-white shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
          onclick={() => (mode = "signIn")}
        >
          <LogIn class="h-4 w-4" /> Entrar
        </button>
        <button
          type="button"
          role="tab"
          id="auth-tab-sign-up"
          aria-selected={mode === "signUp"}
          aria-controls="auth-sign-up"
          class="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition {mode ===
          'signUp'
            ? 'bg-[var(--accent-solid)] text-white shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
          onclick={() => (mode = "signUp")}
        >
          <UserPlus class="h-4 w-4" /> Criar conta
        </button>
      </div>

      <div
        id="auth-sign-in"
        role="tabpanel"
        aria-labelledby="auth-tab-sign-in"
        hidden={mode !== "signIn"}
      >
        <form class="grid gap-5" method="POST" action="?/signIn">
          <input type="hidden" name="redirectTo" value={data.redirectTo} />

          <div class="grid gap-1.5">
            <label for="email" class="label-tech text-[var(--muted)]"
              >Email</label
            >
            <div class="relative">
              <Mail
                class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                id="email"
                class="field pl-9"
                name="email"
                type="email"
                autocomplete="email"
                value={form?.email ?? ""}
                placeholder="voce@exemplo.com"
                required
              />
            </div>
          </div>

          <div class="grid gap-1.5">
            <label for="password" class="label-tech text-[var(--muted)]"
              >Senha</label
            >
            <div class="relative">
              <KeyRound
                class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                id="password"
                class="field pl-9"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            class="button-primary mt-2 w-full py-2.5 text-base"
            type="submit"
          >
            <LogIn class="h-4 w-4" />
            Entrar
          </button>
        </form>

        <button
          type="button"
          class="focus-ring mt-4 inline-flex min-h-11 items-center rounded text-sm text-[var(--muted)] underline-offset-4 hover:underline"
          onclick={() => (showReset = !showReset)}
        >
          Esqueci minha senha
        </button>

        {#if showReset}
          <form
            class="mt-4 grid gap-3 border-t border-[var(--line)] pt-4"
            method="POST"
            action="?/resetPassword"
          >
            <h2 class="label-tech text-[var(--muted)]">Esqueci a senha</h2>
            <label for="reset-email" class="label-tech text-[var(--muted)]"
              >Email</label
            >
            <input
              id="reset-email"
              class="field"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="email@exemplo.com"
              required
            />
            <button class="button-secondary" type="submit"
              >Enviar link de recuperação</button
            >
          </form>
        {/if}

        <div class="relative my-8">
          <div class="absolute inset-0 flex items-center" aria-hidden="true">
            <div class="w-full border-t border-[var(--line)]"></div>
          </div>
          <div class="relative flex justify-center">
            <span class="label-tech bg-[var(--panel)] px-4 text-[var(--muted)]"
              >ou continuar com</span
            >
          </div>
        </div>

        <form method="POST" action="?/google">
          <button class="button-secondary w-full py-2.5" type="submit">
            <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              /><path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              /><path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              /><path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              /><path d="M1 1h22v22H1z" fill="none" /></svg
            >
            Google
          </button>
        </form>
      </div>

      <div
        id="auth-sign-up"
        role="tabpanel"
        aria-labelledby="auth-tab-sign-up"
        hidden={mode !== "signUp"}
      >
        <form class="grid gap-4" method="POST" action="?/signUp">
          <input type="hidden" name="redirectTo" value={data.redirectTo} />
          <h2 class="label-tech text-[var(--muted)]">Nova conta</h2>
          <div class="grid gap-1.5">
            <label for="signup-email" class="label-tech text-[var(--muted)]"
              >Email</label
            >
            <input
              id="signup-email"
              class="field"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="email@exemplo.com"
              required
            />
          </div>
          <div class="grid gap-1.5">
            <label for="signup-password" class="label-tech text-[var(--muted)]"
              >Senha</label
            >
            <input
              id="signup-password"
              class="field"
              name="password"
              type="password"
              autocomplete="new-password"
              placeholder="senha (mínimo 6 caracteres)"
              minlength="6"
              required
            />
          </div>
          <button class="button-primary w-full py-2.5 text-base" type="submit"
            ><UserPlus class="h-4 w-4" /> Criar conta</button
          >
        </form>
      </div>
    </div>
  </div>
</div>

<style>
  .page-glow {
    top: -25%;
    right: -20%;
    width: 70%;
    height: 70%;
  }
</style>
