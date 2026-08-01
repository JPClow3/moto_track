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
          placeholder="Versão"
        />
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
    </div>
  {/if}
</section>
