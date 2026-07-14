<script lang="ts">
  export let data: { redirectTo: string };
  export let form: { message?: string; email?: string } | undefined;
</script>

<svelte:head><title>Entrar · Moto Track</title></svelte:head>

<section class="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2">
  <div>
    <p class="text-sm font-semibold uppercase tracking-wide text-signal">Moto Track</p>
    <h1 class="mt-3 text-4xl font-black">Acesse sua garagem.</h1>
    <p class="mt-4 text-[var(--muted)]">Supabase Auth powers email/password, password recovery, and Google OAuth.</p>
  </div>

  <div class="panel grid gap-6 p-5">
    {#if form?.message}<p class="rounded-md bg-signal/15 p-3 text-sm">{form.message}</p>{/if}
    <form class="grid gap-3" method="POST" action="?/signIn">
      <input type="hidden" name="redirectTo" value={data.redirectTo} />
      <label class="grid gap-1 text-sm">
        Email
        <input class="field" name="email" type="email" value={form?.email ?? ''} required />
      </label>
      <label class="grid gap-1 text-sm">
        Senha
        <input class="field" name="password" type="password" required />
      </label>
      <button class="button-primary" type="submit">Entrar</button>
    </form>
    <form method="POST" action="?/google">
      <button class="button-secondary w-full" type="submit">Entrar com Google</button>
    </form>
    <details class="rounded-md border border-[var(--line)] p-3">
      <summary class="cursor-pointer text-sm font-semibold">Criar conta ou recuperar senha</summary>
      <form class="mt-4 grid gap-3" method="POST" action="?/signUp">
        <input class="field" name="email" type="email" placeholder="email@exemplo.com" required />
        <input class="field" name="password" type="password" placeholder="senha" required />
        <button class="button-secondary" type="submit">Criar conta</button>
      </form>
      <form class="mt-3 grid gap-3" method="POST" action="?/resetPassword">
        <input class="field" name="email" type="email" placeholder="email@exemplo.com" required />
        <button class="button-secondary" type="submit">Enviar recuperação</button>
      </form>
    </details>
  </div>
</section>
