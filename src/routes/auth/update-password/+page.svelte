<script lang="ts">
  import { ShieldAlert, KeyRound } from "lucide-svelte";
  export let form: { message?: string } | undefined;
  export let data: { token: string };
</script>

<svelte:head><title>Nova senha · Moto Track</title></svelte:head>

<div
  class="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
>
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow page-glow" aria-hidden="true"></div>

  <div class="relative w-full max-w-[440px]">
    <div class="mb-8 text-center">
      <a
        href="/"
        class="focus-ring mb-8 inline-block rounded transition hover:opacity-70"
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
      <h1 class="display text-4xl">Defina sua nova senha.</h1>
      <p class="mt-3 text-sm text-[var(--muted)]">
        Escolha uma senha nova para continuar acessando sua garagem.
      </p>
    </div>

    <div class="panel relative overflow-hidden p-6 shadow-lift sm:p-8">
      {#if form?.message}
        <div
          class="mb-6 flex items-start gap-3 rounded border border-danger/30 bg-danger/10 p-4 text-sm"
        >
          <ShieldAlert class="h-5 w-5 shrink-0 text-danger" />
          <p>{form.message}</p>
        </div>
      {/if}

      <form class="grid gap-5" method="POST">
        <input type="hidden" name="token" value={data.token} />
        <div class="grid gap-1.5">
          <label for="password" class="label-tech text-[var(--muted)]"
            >Nova senha</label
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
              placeholder="mínimo 6 caracteres"
              required
              minlength="6"
            />
          </div>
        </div>

        <div class="grid gap-1.5">
          <label for="confirmPassword" class="label-tech text-[var(--muted)]"
            >Confirme a senha</label
          >
          <div class="relative">
            <KeyRound
              class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              id="confirmPassword"
              class="field pl-9"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              minlength="6"
            />
          </div>
        </div>

        <button
          class="button-primary mt-2 w-full py-2.5 text-base"
          type="submit"
        >
          Salvar nova senha
        </button>
      </form>
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
