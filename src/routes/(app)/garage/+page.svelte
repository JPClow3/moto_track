<script lang="ts">
  import { enhance } from '$app/forms';
  export let data;
  export let form;
</script>

<svelte:head><title>Garagem · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><p class="eyebrow"><span class="slash-rule" aria-hidden="true"></span>Garagem</p><h1 class="display text-4xl">Motos ativas e arquivadas</h1><p class="mt-2 text-sm text-[var(--muted)]">Arquivar preserva todo o histórico e permite restauração posterior.</p></div>
  </header>
  {#if form?.message}<p class="rounded bg-danger/10 p-3 text-sm text-danger">{form.message}</p>{/if}
  <div class="grid gap-6 xl:grid-cols-[1fr_340px]">
    <div class="grid gap-4 md:grid-cols-2">
      {#each data.motorcycles as motorcycle}
        <article class:opacity-70={!motorcycle.is_active} class="panel p-5">
          <div class="flex items-start justify-between gap-3"><div><h2 class="text-xl font-bold">{motorcycle.name}</h2><p class="text-sm text-[var(--muted)]">{motorcycle.brand} {motorcycle.model} · {motorcycle.year}</p></div><span class={`label-tech rounded-full px-2.5 py-1 text-xs ${motorcycle.is_active ? 'bg-success/15 text-success' : 'bg-[var(--muted)]/15 text-[var(--muted)]'}`}>{motorcycle.is_active ? 'Ativa' : 'Arquivada'}</span></div>
          <p class="display numeric mt-4 text-4xl">{motorcycle.current_odometer_km} <span class="text-base font-medium">km</span></p>
          <div class="mt-4 flex flex-wrap gap-2">
            {#if motorcycle.is_active}
              <form method="POST" action="?/archive" use:enhance><input type="hidden" name="id" value={motorcycle.id} /><button class="button-danger" type="submit">Arquivar</button></form>
            {:else}
              <form method="POST" action="?/restore" use:enhance><input type="hidden" name="id" value={motorcycle.id} /><button class="button-primary" type="submit">Restaurar</button></form>
            {/if}
          </div>
          {#if motorcycle.is_active}
            <details class="mt-4 border-t border-[var(--line)] pt-3"><summary class="cursor-pointer font-semibold">Odômetro e especificações</summary>
              <form class="mt-3 grid gap-2" method="POST" action="?/updateOdometer" use:enhance><input type="hidden" name="motorcycle_id" value={motorcycle.id} /><label class="grid gap-1 text-sm">Odômetro atual<input class="field" name="odometer_override_km" type="number" min="0" value={motorcycle.current_odometer_km} /></label><button class="button-secondary" type="submit">Atualizar odômetro</button></form>
              <form class="mt-3 grid gap-2" method="POST" action="?/saveSpecs" use:enhance><input type="hidden" name="motorcycle_id" value={motorcycle.id} /><label class="text-sm">Pneu dianteiro<input class="field" name="tire_size_front" value={motorcycle.motorcycle_specs?.[0]?.tire_size_front ?? ''} /></label><label class="text-sm">Pneu traseiro<input class="field" name="tire_size_rear" value={motorcycle.motorcycle_specs?.[0]?.tire_size_rear ?? ''} /></label><label class="text-sm">Manual<input class="field" name="manual_reference" value={motorcycle.motorcycle_specs?.[0]?.manual_reference ?? ''} /></label><button class="button-secondary" type="submit">Salvar especificações</button></form>
            </details>
          {/if}
        </article>
      {:else}<p class="panel p-6 text-[var(--muted)]">Sua garagem está vazia. Cadastre a primeira moto.</p>{/each}
    </div>
    <form class="panel grid gap-3 p-5" method="POST" action="?/create" use:enhance><h2 class="text-lg font-bold">Nova moto</h2><label class="text-sm">Nome<input class="field" name="name" required /></label><label class="text-sm">Marca<input class="field" name="brand" required /></label><label class="text-sm">Modelo<input class="field" name="model" required /></label><label class="text-sm">Ano<input class="field" name="year" type="number" min="1901" required /></label><label class="text-sm">Odômetro<input class="field" name="current_odometer_km" type="number" min="0" value="0" /></label><button class="button-primary" type="submit" disabled={!data.canAddActive}>Cadastrar moto</button>{#if !data.canAddActive}<p class="text-xs text-[var(--muted)]">O plano atual atingiu o limite de motos ativas.</p>{/if}</form>
  </div>
</section>
