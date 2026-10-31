<script lang="ts">
  import { appCopy } from "$lib/i18n/app-copy";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatDate, formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import OwnershipCosts from "$components/OwnershipCosts.svelte";
  import GarageInsights from "$components/GarageInsights.svelte";
  import EmptyState from "$components/ui/EmptyState.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { Motorcycle } from "$components/icons";
  import PageHeader from "$lib/components/app/PageHeader.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import Download from "lucide-svelte/icons/download";
  import ExternalLink from "lucide-svelte/icons/external-link";
  import Filter from "lucide-svelte/icons/filter";
  import ChartNoAxesCombined from "lucide-svelte/icons/chart-no-axes-combined";

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
  // Categorical colours, never red: a cost is not an alert. Work is income,
  // so it stays neutral.
  const SOURCE_COLORS: Record<string, string> = {
    fuel: "var(--cat-fuel)",
    maintenance: "var(--cat-maintenance)",
    tires: "var(--cat-tires)",
    expenses: "var(--cat-fees)",
    work: "var(--muted)",
  };
  const sourceLabel = (source: string) =>
    appCopy($locale, SOURCE_LABELS[source] ?? source);
  const sourceColor = (source: string) =>
    SOURCE_COLORS[source] ?? "var(--muted)";

  $: hasMotorcycles = data.motorcycles.length > 0;
  $: hasFilters = Boolean(
    data.filters.source || data.filters.start || data.filters.end,
  );
  $: timelineEmpty = data.timeline.length === 0 && !hasFilters;

  let formBusy = false;
  let confirmDialog: ConfirmDialog;
  let shareModal: RecordSheet;
  let filterOpen = false;

  // Failures surface once, through form.message; successes close the sheet.
  const enhanceShare: SubmitFunction = () => {
    formBusy = true;
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") shareModal?.close();
      await update();
    };
  };

  const enhanceRevoke: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask(
      appCopy(
        $locale,
        "Revogar este link público? Quem tiver o link perderá o acesso.",
      ),
    );
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") showToast($t("recordsUx.linkRevoked"));
      await update();
    };
  };

  const EXPORTS = [
    { href: "/fuel/export.csv", label: "Abastecimentos" },
    { href: "/maintenance/export.csv", label: "Manutenções" },
    { href: "/tires/export.csv", label: "Pneus" },
    { href: "/expenses/export.csv", label: "Despesas" },
    { href: "/documents/export.csv", label: "Documentos" },
    { href: "/trabalho/export.csv", label: "Trabalho" },
  ];
</script>

<svelte:head><title>{$t("nav.reports")} · Moto Track</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <PageHeader
    title={appCopy($locale, "Linha do tempo e dossiê de venda")}
    description={appCopy(
      $locale,
      "Histórico comprovado de manutenção e eventos da sua moto para valorizar a venda",
    )}
  >
    <svelte:fragment slot="actions">
      {#if hasMotorcycles}
        <button
          type="button"
          class="button-primary min-h-11 px-4 text-sm font-semibold"
          on:click={() => shareModal?.open()}
        >
          {$t("authenticatedUx.generateReport")}
        </button>
      {/if}
    </svelte:fragment>
  </PageHeader>

  <ConfirmDialog
    bind:this={confirmDialog}
    confirmLabel={appCopy($locale, "Revogar")}
    destructive
  />

  {#if form?.message && !form?.benchmark}
    <p
      class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
      role="alert"
      aria-live="assertive"
    >
      {form.message}
    </p>
  {/if}

  {#if !hasMotorcycles}
    <!-- Every report needs a bike's history; one block instead of empty
         cost cards, an empty timeline and export links to empty files. -->
    <EmptyState icon={Motorcycle} title={$t("recordsUx.needsBike")}>
      {#snippet action()}
        <a class="button-primary" href="/garage">{$t("recordsUx.addBike")}</a>
      {/snippet}
    </EmptyState>
  {:else}
    {#if form?.publicUrl}
      <div
        class="panel flex flex-col justify-between gap-3 border-l-4 border-l-[var(--success)] p-4 sm:flex-row sm:items-center"
        role="status"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold">
            {appCopy($locale, "Link público gerado com sucesso!")}
          </p>
          <p class="mt-1 break-all text-xs text-[var(--muted)]">
            {form.publicUrl}
          </p>
        </div>
        <a
          class="button-secondary flex min-h-11 shrink-0 items-center gap-1.5 px-3 py-1 text-xs"
          href={form.publicUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span>{appCopy($locale, "Abrir dossiê")}</span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
    {/if}

    {#if data.insights}
      <GarageInsights
        insights={data.insights}
        benchmarkMessage={form?.benchmark ? String(form.message ?? "") : ""}
      />
    {/if}

    <OwnershipCosts motorcycles={data.ownershipCosts} />

    <!-- Active Public Shares -->
    {#if data.shares && data.shares.length > 0}
      <div class="panel grid gap-3 p-5">
        <h2 class="display text-xl">
          {appCopy($locale, "Dossiês públicos ativos")}
        </h2>
        <div class="mt-1 grid gap-3 md:grid-cols-2">
          {#each data.shares as share (share.id)}
            <article
              class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-4"
            >
              <div class="min-w-0 flex-1 break-words">
                <p class="numeric text-sm font-semibold">
                  {share.token_prefix}…
                </p>
                <p class="mt-0.5 text-xs text-[var(--muted)]">
                  {share.access_count}
                  {appCopy($locale, "acessos · expira")}
                  {formatDate($locale, share.expires_at, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
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
                    class="button-danger min-h-11 px-3 py-1 text-xs"
                    disabled={formBusy}
                  >
                    {appCopy($locale, "Revogar")}
                  </button>
                </form>
              {:else}
                <StatusBadge tone="neutral"
                  >{appCopy($locale, "Revogado")}</StatusBadge
                >
              {/if}
            </article>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Timeline Events with Collapsible Filter -->
    {#if timelineEmpty}
      <EmptyState
        compact
        icon={ChartNoAxesCombined}
        title={$t("recordsUx.timelineEmpty")}
      >
        {#snippet action()}
          <a class="button-primary" href="/fuel?new=1"
            >{$t("recordsUx.logFuel")}</a
          >
        {/snippet}
      </EmptyState>
    {:else}
      <div class="panel overflow-hidden">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4"
        >
          <div>
            <h2 class="display text-xl">
              {appCopy($locale, "Eventos da linha do tempo")}
            </h2>
            <p class="numeric mt-0.5 text-xs text-[var(--muted)]">
              {data.timeline.length}
              {appCopy($locale, "eventos encontrados")}
            </p>
          </div>
          <button
            type="button"
            class="button-secondary flex min-h-11 items-center gap-1.5 px-3 py-1 text-xs"
            aria-expanded={filterOpen}
            on:click={() => (filterOpen = !filterOpen)}
          >
            <Filter size={16} aria-hidden="true" />
            <span>{$t("authenticatedUx.filters")}</span>
          </button>
        </div>

        {#if filterOpen}
          <form
            class="grid gap-3 border-b border-[var(--line)] bg-[var(--panel-sunken)] p-4 sm:grid-cols-3 sm:items-end"
            method="GET"
          >
            <div>
              <label class="field-label" for="reports-source"
                >{appCopy($locale, "Fonte")}</label
              >
              <select
                class="field"
                id="reports-source"
                name="source"
                value={data.filters.source}
              >
                <option value="">{appCopy($locale, "Todas as fontes")}</option>
                <option value="fuel">{appCopy($locale, "Abastecimento")}</option
                >
                <option value="maintenance"
                  >{appCopy($locale, "Manutenção")}</option
                >
                <option value="tires">{appCopy($locale, "Pneus")}</option>
                <option value="expenses">{appCopy($locale, "Despesas")}</option>
                <option value="work">{appCopy($locale, "Trabalho")}</option>
              </select>
            </div>
            <div>
              <label class="field-label" for="reports-start"
                >{appCopy($locale, "Data inicial")}</label
              >
              <input
                class="field"
                id="reports-start"
                name="start"
                type="date"
                value={data.filters.start}
              />
            </div>
            <div>
              <label class="field-label" for="reports-end"
                >{appCopy($locale, "Data final")}</label
              >
              <input
                class="field"
                id="reports-end"
                name="end"
                type="date"
                value={data.filters.end}
              />
            </div>
            <div class="flex justify-end gap-2 sm:col-span-3">
              <a
                href="/reports"
                class="button-secondary min-h-11 px-3 py-1 text-xs"
                >{appCopy($locale, "Limpar")}</a
              >
              <button
                class="button-primary min-h-11 px-4 py-1 text-xs"
                type="submit"
                disabled={formBusy}
              >
                {appCopy($locale, "Aplicar filtros")}
              </button>
            </div>
          </form>
        {/if}

        {#if data.timeline.length > 0}
          <div class="data-table">
            <table class="w-full text-left text-sm">
              <thead
                class="border-b border-[var(--line)] bg-[var(--accent-wash)] text-[var(--muted)]"
              >
                <tr>
                  <th class="label-tech px-4 py-2" scope="col"
                    >{$t("recordsUx.timelineEvent")}</th
                  >
                  <th class="label-tech px-4 py-2" scope="col"
                    >{$t("recordsUx.timelineSource")}</th
                  >
                  <th class="label-tech px-4 py-2" scope="col"
                    >{$t("recordsUx.timelineDate")}</th
                  >
                  <th class="label-tech px-4 py-2 text-right" scope="col"
                    >{$t("recordsUx.timelineAmount")}</th
                  >
                </tr>
              </thead>
              <tbody>
                {#each data.timeline as event, index (index)}
                  <tr
                    class="border-b border-[var(--line)] transition-colors last:border-b-0 hover:bg-[var(--panel-sunken)]"
                  >
                    <td
                      class="break-words px-4 py-3 font-medium"
                      data-label={$t("recordsUx.timelineEvent")}
                      >{event.label}</td
                    >
                    <td
                      class="px-4 py-3"
                      data-label={$t("recordsUx.timelineSource")}
                    >
                      <span class="inline-flex items-center gap-2">
                        <span
                          class="h-2.5 w-2.5 shrink-0 rounded-full"
                          style:background={sourceColor(String(event.source))}
                          aria-hidden="true"
                        ></span>
                        {sourceLabel(String(event.source))}
                      </span>
                    </td>
                    <td
                      class="numeric px-4 py-3 text-[var(--muted)]"
                      data-label={$t("recordsUx.timelineDate")}
                      >{event.date
                        ? formatDate($locale, String(event.date))
                        : $t("common.empty")}</td
                    >
                    <td
                      class="numeric px-4 py-3 text-right font-semibold"
                      data-label={$t("recordsUx.timelineAmount")}
                      >{money(event.amountCents)}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="p-8 text-center text-sm text-[var(--muted)]">
            <p>{appCopy($locale, "Sem eventos para este filtro.")}</p>
            <a
              class="mt-2 inline-block font-semibold text-[var(--fg)] underline underline-offset-4"
              href="/reports">{appCopy($locale, "Limpar")}</a
            >
          </div>
        {/if}
      </div>
    {/if}

    <!-- Secondary Section: Full Data Export -->
    <section class="panel p-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="display text-xl">{$t("authenticatedUx.exportData")}</h2>
          <p class="mt-1 text-sm text-[var(--muted)]">
            {appCopy(
              $locale,
              "Baixe cópias completas em formato CSV dos seus dados para backup ou análise em planilhas.",
            )}
          </p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {#each EXPORTS as item (item.href)}
          <a
            href={item.href}
            class="focus-ring flex min-h-11 items-center justify-between rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3 text-sm transition-colors hover:border-[var(--fg-soft)]"
          >
            <span class="font-medium">{appCopy($locale, item.label)}</span>
            <Download
              size={16}
              class="text-[var(--muted)]"
              aria-hidden="true"
            />
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Sheet to Generate Sale Report / Public Link -->
  <RecordSheet
    bind:this={shareModal}
    title={$t("authenticatedUx.generateReport")}
    description={appCopy(
      $locale,
      "Gere um link seguro com histórico de manutenções e custos para valorizar sua moto na venda.",
    )}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-4"
      method="POST"
      action="?/createShare"
      use:enhance={enhanceShare}
    >
      <div class="field-group">
        <label class="field-label" for="reports-motorcycle"
          >{appCopy($locale, "Moto")}</label
        >
        <select
          class="field"
          id="reports-motorcycle"
          name="motorcycle_id"
          required
        >
          <option value="">{appCopy($locale, "Escolha uma moto")}</option>
          {#each data.motorcycles as moto (moto.id)}
            <option value={moto.id}>
              {moto.name} · {moto.brand}
              {moto.model}
            </option>
          {/each}
        </select>
      </div>

      <div class="field-group">
        <label class="field-label" for="reports-days"
          >{appCopy($locale, "Validade do link (dias)")}</label
        >
        <input
          class="field"
          id="reports-days"
          name="days"
          type="number"
          inputmode="numeric"
          min="1"
          max="90"
          step="1"
          value="14"
          aria-describedby="reports-days-help"
        />
        <p class="field-help" id="reports-days-help">
          {appCopy(
            $locale,
            "Após este prazo, o link expirará automaticamente. Você pode revogá-lo a qualquer momento.",
          )}
        </p>
      </div>

      <div class="sheet-actions">
        <button
          class="button-primary mt-2 min-h-11"
          type="submit"
          disabled={formBusy}
        >
          {appCopy($locale, "Criar link seguro")}
        </button>
      </div>
    </form>
  </RecordSheet>
</section>
