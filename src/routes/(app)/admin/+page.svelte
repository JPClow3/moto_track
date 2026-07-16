<script lang="ts">
  import { enhance } from '$app/forms';
  import MetricCard from '$components/MetricCard.svelte';
  import { t } from '$lib/i18n/store';
  export let data;
  export let form;
</script>

<svelte:head><title>Admin · Moto Track</title></svelte:head>

<section class="grid gap-6">
  <div>
    <p class="eyebrow"><span class="slash-rule" aria-hidden="true"></span>Admin</p>
    <h1 class="display text-4xl">Console operacional</h1>
    <p class="mt-2 text-sm text-[var(--muted)]">Configurações, blog, templates, assinaturas e solicitações de dados.</p>
  </div>

  {#if form?.message}
    <div class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{form.message}</div>
  {/if}

  {#if !data.isStaff}
    <!-- The Admin nav item is now hidden for non-staff, so reaching this means
         typing the URL directly. Says what it means to a person rather than
         narrating our profile schema at them. -->
    <div class="panel p-8 text-center" role="alert">
      <p class="display text-2xl">{$t('admin.notStaffTitle')}</p>
      <p class="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">{$t('admin.notStaffBody')}</p>
      <a class="button-secondary mt-6" href="/dashboard">{$t('error.backToDashboard')}</a>
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-4">
      <MetricCard label="Usuários" value={String(data.counts.users ?? 0)} />
      <MetricCard label="Artigos" value={String(data.counts.articles ?? 0)} />
      <MetricCard label="Eventos Stripe" value={String(data.counts.events ?? 0)} />
      <MetricCard label="Dados" value={String(data.counts.requests ?? 0)} />
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <form class="panel grid gap-3 p-4" method="POST" action="?/saveSettings" use:enhance>
        <h2 class="display text-xl">Configurações do site</h2>
        <input class="field" name="company_name" value={data.settings?.company_name ?? 'Moto Track'} />
        <input class="field" name="support_email" value={data.settings?.support_email ?? ''} placeholder="Email suporte" />
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="field" name="support_phone" value={data.settings?.support_phone ?? ''} placeholder="Telefone" />
          <input class="field" name="support_whatsapp" value={data.settings?.support_whatsapp ?? ''} placeholder="WhatsApp" />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="field" name="address_city" value={data.settings?.address_city ?? ''} placeholder="Cidade" />
          <input class="field" name="address_state" value={data.settings?.address_state ?? ''} placeholder="UF" />
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="field" name="dpo_name" value={data.settings?.dpo_name ?? ''} placeholder="DPO" />
          <input class="field" name="dpo_email" value={data.settings?.dpo_email ?? ''} placeholder="Email DPO" />
        </div>
        <button class="button-primary" type="submit">Salvar</button>
      </form>

      <form class="panel grid gap-3 p-4" method="POST" action="?/createArticle" use:enhance>
        <h2 class="display text-xl">Novo artigo</h2>
        <input class="field" name="title" placeholder="Título" required />
        <input class="field" name="slug" placeholder="slug opcional" />
        <input class="field" name="summary" placeholder="Resumo" required />
        <textarea class="field min-h-32" name="body" placeholder="Conteúdo" required></textarea>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_published" value="true" checked /> Publicado</label>
        <button class="button-primary" type="submit">Publicar</button>
      </form>
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <form class="panel grid gap-3 p-4" method="POST" action="?/createTemplate" use:enhance>
        <h2 class="display text-xl">Template de moto</h2>
        <div class="grid gap-3 sm:grid-cols-2"><input class="field" name="brand" placeholder="Marca" required /><input class="field" name="model" placeholder="Modelo" required /></div>
        <div class="grid gap-3 sm:grid-cols-4"><input class="field" name="year_from" type="number" placeholder="Ano inicial" required /><input class="field" name="year_to" type="number" placeholder="Ano final" /><input class="field" name="engine_cc" type="number" placeholder="cc" required /><input class="field" name="country_code" value="BR" /></div>
        <input class="field" name="variant" placeholder="Versão" />
        <button class="button-secondary" type="submit">Criar template</button>
      </form>

      <div class="panel p-4">
        <h2 class="display text-xl">Solicitações de dados</h2>
        <div class="mt-3 grid gap-2 text-sm">
          {#each data.requests as request}
            <div class="border-t border-[var(--line)] py-2">{request.request_type} · {request.status} · {request.created_at}</div>
          {:else}
            <p class="text-[var(--muted)]">Sem solicitações abertas.</p>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</section>
