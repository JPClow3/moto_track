<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatDate, formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  export let data;
  export let form;
  const money = (c: number) => formatMoney($locale, c);

  // The timeline used to print raw enums ("fuel", "work") next to pt-BR copy.
  const SOURCE_LABELS: Record<string, string> = {
    fuel: "Abastecimento",
    maintenance: "Manutenção",
    tires: "Pneus",
    expenses: "Despesas",
    work: "Trabalho",
  };
  const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;
  // Work sessions are income; painting every positive amount red made
  // earnings look like costs.
  const isCostSource = (source: string) => source !== "work";

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown; publicUrl?: unknown };
  }) => {
    statusRole = result.type === "success" ? "status" : "alert";
    statusMessage =
      result.type === "success"
        ? $t("common.actionSuccess")
        : String(result.data?.message ?? $t("error.serverBody"));
  };

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };

  const enhanceRevoke: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask(
      "Revogar este link público? Quem tiver o link perderá o acesso.",
    );
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };
</script>

<section class="grid gap-6" aria-busy={formBusy}>
  <header>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>Relatórios
    </p>
    <h1 class="display text-4xl">Linha do tempo e dossiê de venda</h1>
  </header>
  <ConfirmDialog bind:this={confirmDialog} confirmLabel="Revogar" />
  {#if form?.message}<p
      class="rounded bg-danger/10 p-3 text-danger"
      role="alert"
      aria-live="assertive"
    >
      {form.message}
    </p>{/if}{#if form?.publicUrl}<p class="panel break-all p-4">
      Link público: <a class="text-[var(--accent)]" href={form.publicUrl}
        >{form.publicUrl}</a
      >
    </p>{/if}
  {#if statusMessage}
    <p
      class={statusRole === "alert"
        ? "rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
    </p>
  {/if}
  <div class="grid gap-6 lg:grid-cols-2">
    <form class="panel grid gap-3 p-5" method="GET">
      <h2 class="font-bold">Filtrar linha do tempo</h2>
      <label class="field-label" for="reports-source">Fonte</label>
      <select
        class="field"
        id="reports-source"
        name="source"
        value={data.filters.source}
        ><option value="">Todas as fontes</option><option value="fuel"
          >Abastecimento</option
        ><option value="maintenance">Manutenção</option><option value="tires"
          >Pneus</option
        ><option value="expenses">Despesas</option><option value="work"
          >Trabalho</option
        ></select
      ><label class="field-label" for="reports-start">Data inicial</label><input
        class="field"
        id="reports-start"
        name="start"
        type="date"
        value={data.filters.start}
      /><label class="field-label" for="reports-end">Data final</label><input
        class="field"
        id="reports-end"
        name="end"
        type="date"
        value={data.filters.end}
      /><button class="button-secondary" type="submit" disabled={formBusy}
        >Aplicar</button
      >
    </form>
    <form
      class="panel grid gap-3 p-5"
      method="POST"
      action="?/createShare"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="font-bold">Dossiê público de venda</h2>
      <label class="field-label" for="reports-motorcycle">Moto</label>
      <select
        class="field"
        id="reports-motorcycle"
        name="motorcycle_id"
        required
        ><option value="">Escolha uma moto</option
        >{#each data.motorcycles as moto}<option value={moto.id}
            >{moto.name} · {moto.brand} {moto.model}</option
          >{/each}</select
      ><label class="field-label" for="reports-days">Validade (dias)</label
      ><input
        class="field"
        id="reports-days"
        name="days"
        type="number"
        min="1"
        value="14"
      /><button class="button-primary" type="submit" disabled={formBusy}
        >Criar link seguro</button
      >
    </form>
  </div>
  <div class="panel overflow-hidden">
    <div class="border-b border-[var(--line)] p-4">
      <h2 class="font-bold">Eventos</h2>
    </div>
    {#each data.timeline as event}<div
        class="flex min-w-0 items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3"
      >
        <div class="min-w-0 flex-1 break-words">
          <p class="font-medium">{event.label}</p>
          <p class="text-xs text-[var(--muted)]">
            {sourceLabel(String(event.source))} · {event.date}
          </p>
        </div>
        <strong
          class:text-danger={event.amountCents > 0 &&
            isCostSource(String(event.source))}
          >{money(event.amountCents)}</strong
        >
      </div>{:else}
      <div class="p-8 text-center text-sm text-[var(--muted)]">
        <p>Sem eventos para este filtro.</p>
        <p class="mt-1 text-xs text-[var(--muted)]">
          Tente ajustar as datas ou a fonte selecionada.
        </p>
      </div>
    {/each}
  </div>
  <div class="grid gap-3 md:grid-cols-2">
    {#each data.shares as share}<article
        class="panel flex min-w-0 flex-wrap items-center justify-between gap-3 p-4"
      >
        <div class="min-w-0 flex-1 break-words">
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
            use:enhance={enhanceRevoke}
          >
            <input type="hidden" name="id" value={share.id} /><button
              class="button-danger min-h-11"
              disabled={formBusy}>Revogar</button
            >
          </form>{/if}
      </article>{/each}
  </div>
</section>
