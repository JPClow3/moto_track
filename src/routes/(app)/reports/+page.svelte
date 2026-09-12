<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatDate, formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import Download from "lucide-svelte/icons/download";
  import ExternalLink from "lucide-svelte/icons/external-link";
  import Filter from "lucide-svelte/icons/filter";

  export let data;
  export let form;

  const money = (c: number) => formatMoney($locale, c);

  const SOURCE_LABELS: Record<string, string> = {
    fuel: "Abastecimento",
    maintenance: "Manutenção",
    tires: "Pneus",
    expenses: "Despesas",
    work: "Trabalho",
  };
  const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;
  const isCostSource = (source: string) => source !== "work";

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;
  let shareModal: RecordSheet;
  let filterOpen = false;

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown; publicUrl?: unknown };
  }) => {
    statusRole = result.type === "success" ? "status" : "alert";
    statusMessage =
      result.type === "success"
        ? $t("common.actionSuccess")
        : String(result.data?.message ?? $t("error.serverBody"));
    if (result.type === "success") {
      shareModal?.close();
    }
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

<svelte:head><title>{$t("nav.reports")} · Moto Track</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <PageHeader
    eyebrow={$t("nav.reports")}
    title="Linha do tempo e dossiê de venda"
    description="Histórico comprovado de manutenção e eventos da sua moto para valorizar a venda"
  >
    <svelte:fragment slot="actions">
      <button
        type="button"
        class="button-primary min-h-11 px-4 text-sm font-semibold"
        on:click={() => shareModal?.open()}
      >
        {$t("authenticatedUx.generateReport")}
      </button>
    </svelte:fragment>
  </PageHeader>

  <ConfirmDialog bind:this={confirmDialog} confirmLabel="Revogar" destructive />

  {#if form?.message}
    <p
      class="rounded bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
    >
      {form.message}
    </p>
  {/if}

  {#if form?.publicUrl}
    <div
      class="panel flex flex-col justify-between gap-3 border-l-4 border-l-[var(--accent)] p-4 sm:flex-row sm:items-center"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold">Link público gerado com sucesso!</p>
        <p class="mt-1 break-all text-xs text-[var(--muted)]">
          {form.publicUrl}
        </p>
      </div>
      <a
        class="button-secondary flex min-h-9 shrink-0 items-center gap-1.5 px-3 py-1 text-xs"
        href={form.publicUrl}
        target="_blank"
        rel="noreferrer"
      >
        <span>Abrir dossiê</span>
        <ExternalLink size={14} />
      </a>
    </div>
  {/if}

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

  <!-- Sheet to Generate Sale Report / Public Link -->
  <RecordSheet
    bind:this={shareModal}
    title={$t("authenticatedUx.generateReport")}
    description="Gere um link seguro com histórico de manutenções e custos para valorizar sua moto na venda."
    closeLabel={$t("authenticatedUx.close") || "Fechar"}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/createShare"
      use:enhance={enhanceWithStatus}
    >
      <div class="field-group">
        <label class="field-label" for="reports-motorcycle">Moto</label>
        <select
          class="field"
          id="reports-motorcycle"
          name="motorcycle_id"
          required
        >
          <option value="">Escolha uma moto</option>
          {#each data.motorcycles as moto}
            <option value={moto.id}>
              {moto.name} · {moto.brand}
              {moto.model}
            </option>
          {/each}
        </select>
      </div>

      <div class="field-group">
        <label class="field-label" for="reports-days"
          >Validade do link (dias)</label
        >
        <input
          class="field"
          id="reports-days"
          name="days"
          type="number"
          min="1"
          max="90"
          value="14"
        />
        <p class="mt-1 text-xs text-[var(--muted)]">
          Após este prazo, o link expirará automaticamente. Você pode revogá-lo
          a qualquer momento.
        </p>
      </div>

      <button
        class="button-primary mt-2 min-h-11"
        type="submit"
        disabled={formBusy}
      >
        Criar link seguro
      </button>
    </form>
  </RecordSheet>

  <!-- Active Public Shares -->
  {#if data.shares && data.shares.length > 0}
    <div class="panel grid gap-3 p-5">
      <h2 class="display text-xl">Dossiês públicos ativos</h2>
      <div class="mt-1 grid gap-3 md:grid-cols-2">
        {#each data.shares as share (share.id)}
          <article
            class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-4"
          >
            <div class="min-w-0 flex-1 break-words">
              <p class="text-sm font-semibold">{share.token_prefix}…</p>
              <p class="mt-0.5 text-xs text-[var(--muted)]">
                {share.access_count} acessos · expira {formatDate(
                  $locale,
                  share.expires_at,
                  { day: "2-digit", month: "2-digit", year: "numeric" },
                )}
              </p>
            </div>
            {#if !share.revoked_at}
              <form
                method="POST"
                action="?/revokeShare"
                use:enhance={enhanceRevoke}
              >
                <input type="hidden" name="id" value={share.id} />
                <button
                  class="button-danger min-h-9 px-3 py-1 text-xs"
                  disabled={formBusy}
                >
                  Revogar
                </button>
              </form>
            {:else}
              <span class="label-tech text-xs text-[var(--muted)]"
                >Revogado</span
              >
            {/if}
          </article>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Timeline Events with Collapsible Filter -->
  <div class="panel overflow-hidden">
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4"
    >
      <div>
        <h2 class="display text-xl">Eventos da linha do tempo</h2>
        <p class="mt-0.5 text-xs text-[var(--muted)]">
          {data.timeline.length} eventos encontrados
        </p>
      </div>
      <button
        type="button"
        class="button-secondary flex min-h-9 items-center gap-1.5 px-3 py-1 text-xs"
        on:click={() => (filterOpen = !filterOpen)}
      >
        <Filter size={14} />
        <span>{$t("authenticatedUx.filters")}</span>
      </button>
    </div>

    {#if filterOpen}
      <form
        class="grid gap-3 border-b border-[var(--line)] bg-[var(--panel-sunken)] p-4 sm:grid-cols-3 sm:items-end"
        method="GET"
      >
        <div>
          <label class="field-label" for="reports-source">Fonte</label>
          <select
            class="field"
            id="reports-source"
            name="source"
            value={data.filters.source}
          >
            <option value="">Todas as fontes</option>
            <option value="fuel">Abastecimento</option>
            <option value="maintenance">Manutenção</option>
            <option value="tires">Pneus</option>
            <option value="expenses">Despesas</option>
            <option value="work">Trabalho</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="reports-start">Data inicial</label>
          <input
            class="field"
            id="reports-start"
            name="start"
            type="date"
            value={data.filters.start}
          />
        </div>
        <div>
          <label class="field-label" for="reports-end">Data final</label>
          <input
            class="field"
            id="reports-end"
            name="end"
            type="date"
            value={data.filters.end}
          />
        </div>
        <div class="flex justify-end gap-2 sm:col-span-3">
          <a href="/reports" class="button-secondary min-h-9 px-3 py-1 text-xs"
            >Limpar</a
          >
          <button
            class="button-primary min-h-9 px-4 py-1 text-xs"
            type="submit"
            disabled={formBusy}
          >
            Aplicar filtros
          </button>
        </div>
      </form>
    {/if}

    <div class="divide-y divide-[var(--line)]">
      {#each data.timeline as event}
        <div
          class="flex min-w-0 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[var(--panel-sunken)]"
        >
          <div class="min-w-0 flex-1 break-words">
            <p class="text-sm font-medium">{event.label}</p>
            <p class="text-xs text-[var(--muted)]">
              {sourceLabel(String(event.source))} · {event.date}
            </p>
          </div>
          <strong
            class="numeric text-sm"
            class:text-danger={event.amountCents > 0 &&
              isCostSource(String(event.source))}
          >
            {money(event.amountCents)}
          </strong>
        </div>
      {:else}
        <div class="p-8 text-center text-sm text-[var(--muted)]">
          <p>Sem eventos para este filtro.</p>
          <p class="mt-1 text-xs text-[var(--muted)]">
            Tente ajustar as datas ou a fonte selecionada.
          </p>
        </div>
      {/each}
    </div>
  </div>

  <!-- Secondary Section: Full Data Export -->
  <section class="panel p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="display text-xl">{$t("authenticatedUx.exportData")}</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">
          Baixe cópias completas em formato CSV dos seus dados para backup ou
          análise em planilhas.
        </p>
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      <a
        href="/fuel/export.csv"
        class="focus-ring flex items-center justify-between rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm transition-colors hover:border-[var(--accent)]"
      >
        <span class="font-medium">Abastecimentos</span>
        <Download size={16} class="text-[var(--muted)]" />
      </a>
      <a
        href="/maintenance/export.csv"
        class="focus-ring flex items-center justify-between rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm transition-colors hover:border-[var(--accent)]"
      >
        <span class="font-medium">Manutenções</span>
        <Download size={16} class="text-[var(--muted)]" />
      </a>
      <a
        href="/tires/export.csv"
        class="focus-ring flex items-center justify-between rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm transition-colors hover:border-[var(--accent)]"
      >
        <span class="font-medium">Pneus</span>
        <Download size={16} class="text-[var(--muted)]" />
      </a>
      <a
        href="/expenses/export.csv"
        class="focus-ring flex items-center justify-between rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm transition-colors hover:border-[var(--accent)]"
      >
        <span class="font-medium">Despesas</span>
        <Download size={16} class="text-[var(--muted)]" />
      </a>
      <a
        href="/documents/export.csv"
        class="focus-ring flex items-center justify-between rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm transition-colors hover:border-[var(--accent)]"
      >
        <span class="font-medium">Documentos</span>
        <Download size={16} class="text-[var(--muted)]" />
      </a>
      <a
        href="/trabalho/export.csv"
        class="focus-ring flex items-center justify-between rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm transition-colors hover:border-[var(--accent)]"
      >
        <span class="font-medium">Trabalho</span>
        <Download size={16} class="text-[var(--muted)]" />
      </a>
    </div>
  </section>
</section>
