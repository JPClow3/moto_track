<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import MetricCard from "$components/MetricCard.svelte";
  import { t } from "$lib/i18n/store";
  export let data;
  export let form;

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      statusRole = result.type === "success" ? "status" : "alert";
      statusMessage =
        result.type === "success"
          ? "Operação concluída."
          : String(
              "data" in result && result.data?.message
                ? result.data.message
                : "Não foi possível concluir.",
            );
      await update();
    };
  };
</script>

<svelte:head><title>Admin · Moto Track</title></svelte:head>

<section class="grid gap-6" aria-busy={formBusy}>
  <div>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>Admin
    </p>
    <h1 class="display text-4xl">Console operacional</h1>
    <p class="mt-2 text-sm text-[var(--muted)]">
      Configurações, blog, templates, assinaturas e solicitações de dados.
    </p>
  </div>

  {#if form?.message}
    <div
      class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
    >
      {form.message}
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

  {#if !data.isStaff}
    <!-- The Admin nav item is now hidden for non-staff, so reaching this means
         typing the URL directly. Says what it means to a person rather than
         narrating our profile schema at them. -->
    <div class="panel p-8 text-center" role="alert">
      <p class="display text-2xl">{$t("admin.notStaffTitle")}</p>
      <p class="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
        {$t("admin.notStaffBody")}
      </p>
      <a class="button-secondary mt-6" href="/dashboard"
        >{$t("error.backToDashboard")}</a
      >
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-4">
      <MetricCard label="Usuários" value={String(data.counts.users ?? 0)} />
      <MetricCard label="Artigos" value={String(data.counts.articles ?? 0)} />
      <MetricCard
        label="Eventos Stripe"
        value={String(data.counts.events ?? 0)}
      />
      <MetricCard label="Dados" value={String(data.counts.requests ?? 0)} />
    </div>

    <section class="panel grid gap-4 p-4" aria-labelledby="worker-ops-heading">
      <div>
        <h2 id="worker-ops-heading" class="display text-xl">
          Lembretes e limpeza de arquivos
        </h2>
        <p class="mt-1 text-sm text-[var(--muted)]">
          Resumo operacional sem dados de conta ou identificadores de arquivos.
        </p>
      </div>

      {#if !data.workerOperations.available}
        <p class="rounded border border-warning/30 bg-warning/10 p-3 text-sm">
          Histórico operacional indisponível. Confirme as migrações e a conexão
          do Worker.
        </p>
      {:else}
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded border border-[var(--line)] p-3">
            <h3 class="text-sm font-semibold">Fila de exclusão no R2</h3>
            <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt class="text-[var(--muted)]">Na fila</dt>
              <dd>{data.workerOperations.deletionBacklog?.queued ?? 0}</dd>
              <dt class="text-[var(--muted)]">Prontos para tentar</dt>
              <dd>{data.workerOperations.deletionBacklog?.due_now ?? 0}</dd>
              <dt class="text-[var(--muted)]">Mais tentativas</dt>
              <dd>
                {data.workerOperations.deletionBacklog?.highest_attempt_count ??
                  0}
              </dd>
              <dt class="text-[var(--muted)]">Idade do item mais antigo</dt>
              <dd>
                {#if data.workerOperations.deletionBacklog?.oldest_item_age_seconds != null}
                  {Math.floor(
                    data.workerOperations.deletionBacklog
                      .oldest_item_age_seconds / 3600,
                  )}h
                {:else}
                  —
                {/if}
              </dd>
            </dl>
          </div>

          <div class="rounded border border-[var(--line)] p-3">
            <h3 class="text-sm font-semibold">Execução mais recente</h3>
            {#if data.workerOperations.recentRuns[0]}
              {@const run = data.workerOperations.recentRuns[0]}
              <p class="mt-2 text-sm">
                {run.trigger_source === "scheduled" ? "Agendada" : "Manual"}
                · {run.status} · {new Date(run.started_at).toLocaleString()}
              </p>
              {#if run.failure_codes.length}
                <p class="mt-1 text-sm text-danger">
                  Falhas: {run.failure_codes.join(", ")}
                </p>
              {/if}
              <p class="mt-1 text-xs text-[var(--muted)]">
                Lembretes: {run.reminders_emailed ?? 0} enviados por email,
                {run.reminders_pushed ?? 0} por push; exclusões R2: {run.deletions_succeeded ??
                  0}/{run.deletions_attempted ?? 0} concluídas.
              </p>
            {:else}
              <p class="mt-2 text-sm text-[var(--muted)]">
                Nenhuma execução registrada.
              </p>
            {/if}
          </div>
        </div>

        <div class="rounded border border-[var(--line)] p-3">
          <h3 class="text-sm font-semibold">Execução cron agendada</h3>
          <p class="mt-2 text-sm">
            Horário de referência: 08:00 UTC ·
            {new Date(data.workerOperations.expectedLatestScheduledSlotAt)
              .toISOString()
              .slice(0, 10)}
          </p>
          {#if data.workerOperations.latestScheduledRun}
            <p class="mt-1 text-sm">
              Último registro:
              {new Date(
                data.workerOperations.latestScheduledRun.started_at,
              ).toLocaleString()}
              · {data.workerOperations.latestScheduledRun.status}
            </p>
          {:else}
            <p class="mt-1 text-sm text-[var(--muted)]">
              Nenhuma execução cron registrada.
            </p>
          {/if}
          <p
            class="mt-1 text-sm"
            class:text-warning={!data.workerOperations
              .latestScheduledSlotRecorded}
          >
            {data.workerOperations.latestScheduledSlotRecorded
              ? "Há um registro no horário de referência."
              : "O horário de referência ainda não aparece no histórico."}
          </p>
          <p class="mt-1 text-xs text-[var(--muted)]">
            Comparação direta, sem janela de tolerância configurada; confirme
            atrasos e falhas nos logs do Cloudflare.
          </p>
        </div>

        <details>
          <summary class="cursor-pointer text-sm font-medium">
            Últimas execuções
          </summary>
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="text-xs text-[var(--muted)]">
                  <th class="py-1 pr-4 font-medium">Início</th>
                  <th class="py-1 pr-4 font-medium">Origem</th>
                  <th class="py-1 pr-4 font-medium">Estado</th>
                  <th class="py-1 pr-4 font-medium">Vencimentos</th>
                  <th class="py-1 pr-4 font-medium">Exclusões</th>
                  <th class="py-1 font-medium">Falhas</th>
                </tr>
              </thead>
              <tbody>
                {#each data.workerOperations.recentRuns as run (run.started_at)}
                  <tr class="border-t border-[var(--line)]">
                    <td class="py-1.5 pr-4">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td class="py-1.5 pr-4">
                      {run.trigger_source === "scheduled"
                        ? "Agendada"
                        : "Manual"}
                    </td>
                    <td class="py-1.5 pr-4">{run.status}</td>
                    <td class="py-1.5 pr-4">
                      {run.reminders_due ?? "—"}
                      ({run.reminders_emailed ?? 0} email /
                      {run.reminders_pushed ?? 0} push)
                    </td>
                    <td class="py-1.5 pr-4">
                      {run.deletions_succeeded ?? 0}/{run.deletions_attempted ??
                        0} ({run.deletions_failed ?? 0} falhas)
                    </td>
                    <td class="py-1.5">
                      {run.failure_codes.length
                        ? run.failure_codes.join(", ")
                        : "—"}
                    </td>
                  </tr>
                {:else}
                  <tr>
                    <td
                      colspan="6"
                      class="py-4 text-center text-[var(--muted)]"
                    >
                      Nenhuma execução registrada.
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </details>
        <p class="text-xs text-[var(--muted)]">
          Esta tela não envia alertas; revise os dados e os logs do Worker
          conforme o runbook operacional.
        </p>
      {/if}
    </section>

    <div class="grid gap-6 xl:grid-cols-2">
      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/saveSettings"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">Configurações do site</h2>
        <label class="field-label" for="admin-company">Nome da empresa</label>
        <input
          class="field"
          id="admin-company"
          name="company_name"
          value={data.settings?.company_name ?? "Moto Track"}
        />
        <label class="field-label" for="admin-support-email"
          >Email de suporte</label
        >
        <input
          class="field"
          id="admin-support-email"
          name="support_email"
          value={data.settings?.support_email ?? ""}
          placeholder="Email suporte"
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="admin-support-phone">Telefone</label
            >
            <input
              class="field"
              id="admin-support-phone"
              name="support_phone"
              value={data.settings?.support_phone ?? ""}
              placeholder="Telefone"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-support-whatsapp"
              >WhatsApp</label
            >
            <input
              class="field"
              id="admin-support-whatsapp"
              name="support_whatsapp"
              value={data.settings?.support_whatsapp ?? ""}
              placeholder="WhatsApp"
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="admin-city">Cidade</label>
            <input
              class="field"
              id="admin-city"
              name="address_city"
              value={data.settings?.address_city ?? ""}
              placeholder="Cidade"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-state">UF</label>
            <input
              class="field"
              id="admin-state"
              name="address_state"
              value={data.settings?.address_state ?? ""}
              placeholder="UF"
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="admin-dpo-name">DPO</label>
            <input
              class="field"
              id="admin-dpo-name"
              name="dpo_name"
              value={data.settings?.dpo_name ?? ""}
              placeholder="DPO"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-dpo-email">Email DPO</label>
            <input
              class="field"
              id="admin-dpo-email"
              name="dpo_email"
              value={data.settings?.dpo_email ?? ""}
              placeholder="Email DPO"
            />
          </div>
        </div>
        <button class="button-primary" type="submit" disabled={formBusy}
          >Salvar</button
        >
      </form>

      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/createArticle"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">Novo artigo</h2>
        <label class="field-label" for="article-title">Título</label>
        <input
          class="field"
          id="article-title"
          name="title"
          placeholder="Título"
          required
        />
        <label class="field-label" for="article-slug">Slug (opcional)</label>
        <input
          class="field"
          id="article-slug"
          name="slug"
          placeholder="slug opcional"
        />
        <label class="field-label" for="article-summary">Resumo</label>
        <input
          class="field"
          id="article-summary"
          name="summary"
          placeholder="Resumo"
          required
        />
        <label class="field-label" for="article-body">Conteúdo</label>
        <textarea
          class="field min-h-32"
          id="article-body"
          name="body"
          placeholder="Conteúdo"
          required
        ></textarea>
        <label class="flex items-center gap-2 text-sm" for="article-published"
          ><input
            id="article-published"
            type="checkbox"
            name="is_published"
            value="true"
            checked
          /> Publicado</label
        >
        <button class="button-primary" type="submit" disabled={formBusy}
          >Publicar</button
        >
      </form>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <form
        class="panel grid gap-3 p-4"
        method="POST"
        action="?/createTemplate"
        use:enhance={enhanceWithStatus}
      >
        <h2 class="display text-xl">Template de moto</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field-group">
            <label class="field-label" for="template-brand">Marca</label>
            <input
              class="field"
              id="template-brand"
              name="brand"
              placeholder="Marca"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-model">Modelo</label>
            <input
              class="field"
              id="template-model"
              name="model"
              placeholder="Modelo"
              required
            />
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-4">
          <div class="field-group">
            <label class="field-label" for="template-year-from"
              >Ano inicial</label
            >
            <input
              class="field"
              id="template-year-from"
              name="year_from"
              type="number"
              placeholder="Ano inicial"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-year-to">Ano final</label>
            <input
              class="field"
              id="template-year-to"
              name="year_to"
              type="number"
              placeholder="Ano final"
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-engine">Cilindrada</label>
            <input
              class="field"
              id="template-engine"
              name="engine_cc"
              type="number"
              placeholder="cc"
              required
            />
          </div>
          <div class="field-group">
            <label class="field-label" for="template-country">País</label>
            <input
              class="field"
              id="template-country"
              name="country_code"
              value="BR"
            />
          </div>
        </div>
        <label class="field-label" for="template-variant">Versão</label>
        <input
          class="field"
          id="template-variant"
          name="variant"
          placeholder="Versão (vazio = Linha)"
        />
        <p class="text-xs text-[var(--muted)]">
          O template nasce invisível no catálogo; registre a fonte oficial e a
          tabela de manutenção antes de torná-lo visível.
        </p>
        <button class="button-secondary" type="submit" disabled={formBusy}
          >Criar template</button
        >
      </form>

      <div class="panel p-4">
        <h2 class="display text-xl">Solicitações de dados</h2>
        <div class="mt-3 grid gap-2 text-sm">
          {#each data.requests as request}
            <div
              class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-2"
            >
              <span>
                {request.request_type} · {request.status} · {request.created_at}
              </span>
              {#if request.status === "open"}
                <form
                  method="POST"
                  action="?/fulfillDataRequest"
                  use:enhance={enhanceWithStatus}
                >
                  <input type="hidden" name="id" value={request.id} />
                  <button
                    class="button-secondary px-3 py-1.5 text-xs"
                    disabled={formBusy}
                    type="submit">Marcar cumprida</button
                  >
                </form>
              {/if}
            </div>
          {:else}
            <p class="text-[var(--muted)]">Sem solicitações abertas.</p>
          {/each}
        </div>
      </div>

      <div class="panel p-4 xl:col-span-2">
        <h2 class="display text-xl">Fontes do catálogo por verificação</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">
          Verificação mais antiga primeiro. Um modelo exato com 0 itens não gera
          agenda; um modelo Linha nunca gera — transcreva a tabela antes de
          torná-lo visível.
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-[var(--muted)]">
                <th class="py-1 pr-4 font-medium">Modelo</th>
                <th class="py-1 pr-4 font-medium">Anos</th>
                <th class="py-1 pr-4 font-medium">Documento</th>
                <th class="py-1 pr-4 font-medium">Verificado em</th>
                <th class="py-1 font-medium">Itens</th>
              </tr>
            </thead>
            <tbody>
              {#each data.manualSources as source}
                <tr class="border-t border-[var(--line)]">
                  <td class="py-1.5 pr-4">
                    {source.brand}
                    {source.model}
                    {source.variant}
                    {#if source.is_exact_schedule}
                      <span
                        class="label-tech ml-1 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--accent)]"
                        >Exata</span
                      >
                    {/if}
                  </td>
                  <td class="py-1.5 pr-4">
                    {source.year_from}–{source.year_to ?? source.year_from}
                  </td>
                  <td class="py-1.5 pr-4">{source.document_version}</td>
                  <td class="py-1.5 pr-4">{source.last_verified_date}</td>
                  <td
                    class="py-1.5 {source.maintenance_count === 0
                      ? 'font-semibold text-danger'
                      : ''}"
                  >
                    {source.maintenance_count}
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="5" class="py-4 text-center text-[var(--muted)]">
                    Nenhuma fonte registrada.
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</section>
