<script lang="ts">
  import { enhance } from '$app/forms';
  import type { FeatureConfig } from '$server/domain/features';

  export let feature: FeatureConfig;
  export let rows: Array<Record<string, unknown>> = [];
  export let errorMessage = '';

  function valueFor(row: Record<string, unknown>, key: string) {
    const value = row[key];
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (key.endsWith('_cents') && typeof value === 'number') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
    }
    if (key.endsWith('_millicents') && typeof value === 'number') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 3 }).format(value / 100000);
    }
    return String(value);
  }
</script>

<section class="grid gap-6">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-sm font-semibold uppercase tracking-wide text-signal">{feature.slug}</p>
      <h1 class="text-3xl font-bold">{feature.title}</h1>
      <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">{feature.subtitle}</p>
    </div>
    <a class="button-secondary" href={`/${feature.slug}/export.csv`}>Export CSV</a>
  </div>

  {#if errorMessage}
    <div class="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{errorMessage}</div>
  {/if}

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div class="panel overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
            <tr>
              {#each feature.listColumns as column}
                <th class="px-4 py-3 font-semibold">{column.replaceAll('_', ' ')}</th>
              {/each}
              <th class="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr class="border-b border-[var(--line)] last:border-0">
                {#each feature.listColumns as column}
                  <td class="px-4 py-3">{valueFor(row, column)}</td>
                {/each}
                <td class="px-4 py-3 text-xs text-[var(--muted)]">{valueFor(row, 'updated_at')}</td>
              </tr>
            {:else}
              <tr>
                <td class="px-4 py-12 text-center text-[var(--muted)]" colspan={feature.listColumns.length + 1}>
                  Sem registros ainda.
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <form class="panel grid gap-3 p-4" method="POST" use:enhance>
      <div>
        <h2 class="text-lg font-semibold">Novo registro</h2>
        <p class="text-sm text-[var(--muted)]">Validação server-side com Supabase RLS.</p>
      </div>
      {#each feature.fields as field}
        <label class="grid gap-1 text-sm">
          <span class="font-medium">{field.label}</span>
          {#if field.kind === 'textarea'}
            <textarea class="field min-h-24" name={field.key} required={field.required}></textarea>
          {:else if field.kind === 'boolean'}
            <span class="flex items-center gap-2">
              <input class="h-4 w-4" type="checkbox" name={field.key} value="true" />
              <span class="text-[var(--muted)]">Ativado</span>
            </span>
          {:else}
            <input
              class="field"
              name={field.key}
              type={field.kind === 'date' ? 'date' : field.kind === 'number' || field.kind === 'money' ? 'number' : 'text'}
              step={field.kind === 'money' ? '0.01' : 'any'}
              required={field.required}
            />
          {/if}
          {#if field.help}<span class="text-xs text-[var(--muted)]">{field.help}</span>{/if}
        </label>
      {/each}
      <button class="button-primary mt-2" type="submit">Salvar</button>
    </form>
  </div>
</section>
