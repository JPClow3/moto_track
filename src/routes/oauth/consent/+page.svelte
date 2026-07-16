<script lang="ts">
  import { ShieldAlert, ShieldCheck, Link2, X } from 'lucide-svelte';

  export let data: {
    authorizationId: string;
    client: { id: string; name: string; uri: string; logo_uri: string };
    redirectUri: string;
    scopes: string[];
  };
  export let form: { message?: string } | undefined;

  const scopeLabels: Record<string, string> = {
    openid: 'Confirmar sua identidade',
    email: 'Ver seu email',
    profile: 'Ver seu perfil básico',
  };
</script>

<svelte:head><title>Autorizar {data.client.name} · Moto Track</title></svelte:head>

<div class="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow page-glow" aria-hidden="true"></div>

  <div class="relative w-full max-w-[440px]">
    <div class="mb-8 text-center">
      <a href="/" class="focus-ring mb-8 inline-block rounded transition hover:opacity-70">
        <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="mx-auto h-8 dark:hidden" />
        <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="mx-auto hidden h-8 dark:block" />
      </a>
      <h1 class="display text-3xl">Autorizar acesso</h1>
      <p class="mt-3 text-sm text-[var(--muted)]">
        <strong>{data.client.name}</strong> quer acessar sua conta Moto Track.
      </p>
    </div>

    <div class="panel relative overflow-hidden p-6 shadow-lift sm:p-8">
      {#if form?.message}
        <div class="mb-6 flex items-start gap-3 rounded border border-danger/30 bg-danger/10 p-4 text-sm">
          <ShieldAlert class="h-5 w-5 shrink-0 text-danger" />
          <p>{form.message}</p>
        </div>
      {/if}

      <div class="mb-6 flex items-center gap-3 rounded border border-[var(--line)] p-4">
        {#if data.client.logo_uri}
          <img src={data.client.logo_uri} alt="" class="h-10 w-10 shrink-0 rounded" />
        {/if}
        <div class="min-w-0">
          <p class="truncate font-semibold">{data.client.name}</p>
          {#if data.client.uri}
            <a href={data.client.uri} target="_blank" rel="noreferrer" class="flex items-center gap-1 truncate text-xs text-[var(--muted)] hover:text-[var(--accent)]">
              <Link2 class="h-3 w-3 shrink-0" />
              {data.client.uri}
            </a>
          {/if}
        </div>
      </div>

      {#if data.scopes.length}
        <div class="mb-6">
          <p class="label-tech mb-3 text-[var(--muted)]">Este app poderá</p>
          <ul class="grid gap-2 text-sm">
            {#each data.scopes as scope (scope)}
              <li class="flex items-center gap-2">
                <ShieldCheck class="h-4 w-4 shrink-0 text-[var(--accent)]" />
                {scopeLabels[scope] ?? scope}
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <p class="mb-6 text-xs text-[var(--muted)]">
        Você será redirecionado para <span class="break-all">{data.redirectUri}</span>.
      </p>

      <div class="grid grid-cols-2 gap-3">
        <form method="POST" action="?/deny">
          <input type="hidden" name="authorization_id" value={data.authorizationId} />
          <button class="button-secondary w-full py-2.5" type="submit">
            <X class="h-4 w-4" />
            Negar
          </button>
        </form>
        <form method="POST" action="?/approve">
          <input type="hidden" name="authorization_id" value={data.authorizationId} />
          <button class="button-primary w-full py-2.5" type="submit">
            <ShieldCheck class="h-4 w-4" />
            Autorizar
          </button>
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
