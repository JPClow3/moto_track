<script lang="ts">
  import { enhance } from "$app/forms";
  import { locale } from "$lib/i18n/store";
  import { formatDate, formatMoney } from "$lib/i18n";
  export let data;
  export let form;
  const money = (c: number) => formatMoney($locale, c);
</script>

<section class="grid gap-6">
  <header>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>Relatórios
    </p>
    <h1 class="display text-4xl">Linha do tempo e dossiê de venda</h1>
  </header>
  {#if form?.message}<p class="rounded bg-danger/10 p-3 text-danger">
      {form.message}
    </p>{/if}{#if form?.publicUrl}<p class="panel break-all p-4">
      Link público: <a class="text-[var(--accent)]" href={form.publicUrl}
        >{form.publicUrl}</a
      >
    </p>{/if}
  <div class="grid gap-6 lg:grid-cols-2">
    <form class="panel grid gap-3 p-5" method="GET">
      <h2 class="font-bold">Filtrar linha do tempo</h2>
      <select class="field" name="source" value={data.filters.source}
        ><option value="">Todas as fontes</option><option value="fuel"
          >Abastecimento</option
        ><option value="maintenance">Manutenção</option><option value="tires"
          >Pneus</option
        ><option value="expenses">Despesas</option><option value="work"
          >Trabalho</option
        ></select
      ><input
        class="field"
        name="start"
        type="date"
        value={data.filters.start}
      /><input
        class="field"
        name="end"
        type="date"
        value={data.filters.end}
      /><button class="button-secondary">Aplicar</button>
    </form>
    <form
      class="panel grid gap-3 p-5"
      method="POST"
      action="?/createShare"
      use:enhance
    >
      <h2 class="font-bold">Dossiê público de venda</h2>
      <select class="field" name="motorcycle_id" required
        ><option value="">Escolha uma moto</option
        >{#each data.motorcycles as moto}<option value={moto.id}
            >{moto.name} · {moto.brand} {moto.model}</option
          >{/each}</select
      ><input
        class="field"
        name="days"
        type="number"
        min="1"
        value="14"
      /><button class="button-primary">Criar link seguro</button>
    </form>
  </div>
  <div class="panel overflow-hidden">
    <div class="border-b border-[var(--line)] p-4">
      <h2 class="font-bold">Eventos</h2>
    </div>
    {#each data.timeline as event}<div
        class="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3"
      >
        <div>
          <p class="font-medium">{event.label}</p>
          <p class="text-xs text-[var(--muted)]">
            {event.source} · {event.date}
          </p>
        </div>
        <strong class:text-danger={event.amountCents > 0}
          >{money(event.amountCents)}</strong
        >
      </div>{:else}<p class="p-6 text-[var(--muted)]">
        Sem eventos para este filtro.
      </p>{/each}
  </div>
  <div class="grid gap-3 md:grid-cols-2">
    {#each data.shares as share}<article
        class="panel flex items-center justify-between gap-3 p-4"
      >
        <div>
          <p class="font-semibold">{share.token_prefix}…</p>
          <p class="text-xs text-[var(--muted)]">
            {share.access_count} acessos · expira {formatDate(
              $locale,
              share.expires_at,
              { day: "2-digit", month: "2-digit", year: "numeric" },
            )}
          </p>
        </div>
        {#if !share.revoked_at}<form
            method="POST"
            action="?/revokeShare"
            use:enhance
          >
            <input type="hidden" name="id" value={share.id} /><button
              class="button-danger">Revogar</button
            >
          </form>{/if}
      </article>{/each}
  </div>
</section>
