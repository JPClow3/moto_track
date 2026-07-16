<script lang="ts">
  import { enhance } from '$app/forms';
  import type { FeatureConfig } from '$server/domain/features';

  export let feature: FeatureConfig;
  export let rows: Array<Record<string, unknown>> = [];
  export let motorcycles: Array<{ id: string; name: string; brand: string; model: string }> = [];
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
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>
        {feature.slug}
      </p>
      <h1 class="display mt-3 text-4xl">{feature.title}</h1>
      <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">{feature.subtitle}</p>
    </div>
    <a class="button-secondary shrink-0" href={`/${feature.slug}/export.csv`}>Exportar CSV</a>
  </div>

  {#if errorMessage}
    <div class="rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{errorMessage}</div>
  {/if}

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between gap-3 border-b border-[var(--accent)]/20 bg-[var(--accent-soft)] px-4 py-2.5">
        <span class="label-tech text-[var(--accent)]">{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] text-[var(--muted)]">
            <tr>
              {#each feature.listColumns as column}
                <th class="label-tech px-4 py-3 text-left">{column.replaceAll('_', ' ')}</th>
              {/each}
              <th class="label-tech px-4 py-3 text-left">Status</th>
              <th class="label-tech px-4 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr class="row-hover border-b border-[var(--line)]">
                  {#each feature.listColumns as column}
                    <td class="px-4 py-3">{valueFor(row, column)}</td>
                  {/each}
                  <td class="px-4 py-3 text-xs text-[var(--muted)]">{valueFor(row, 'updated_at')}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-2">
                      {#if feature.slug === 'reminders'}
                        <form method="POST" action="?/snoozeDays" use:enhance>
                          <input type="hidden" name="id" value={String(row.id ?? '')} />
                          <input type="hidden" name="days" value="7" />
                          <button class="button-secondary min-h-8 px-3 py-1 text-xs" type="submit">+7 dias</button>
                        </form>
                        <form method="POST" action="?/snoozeKm" use:enhance>
                          <input type="hidden" name="id" value={String(row.id ?? '')} />
                          <input type="hidden" name="km" value="500" />
                          <button class="button-secondary min-h-8 px-3 py-1 text-xs" type="submit">+500 km</button>
                        </form>
                        <form method="POST" action="?/complete" use:enhance>
                          <input type="hidden" name="id" value={String(row.id ?? '')} />
                          <button class="button-primary min-h-8 px-3 py-1 text-xs" type="submit">Concluir</button>
                        </form>
                      {/if}
                      <form method="POST" use:enhance>
                        <input type="hidden" name="_intent" value="delete" />
                        <input type="hidden" name="id" value={String(row.id ?? '')} />
                        <button class="button-danger min-h-8 px-3 py-1 text-xs" type="submit">Excluir</button>
                      </form>
                    </div>
                  </td>
                </tr>
                <tr class="edit-row border-b border-[var(--line)]">
                  <td class="px-4 py-3" colspan={feature.listColumns.length + 2}>
                    <details>
                      <summary class="cursor-pointer text-sm font-semibold">Editar registro</summary>
                      <form class="mt-3 grid gap-3 md:grid-cols-2" method="POST" enctype="multipart/form-data" use:enhance>
                        <input type="hidden" name="_intent" value="update" />
                        <input type="hidden" name="id" value={String(row.id ?? '')} />
                        {#each feature.fields as field}
                          <label class="grid gap-1 text-sm">
                            <span class="font-medium">{field.label}</span>
                            {#if field.kind === 'textarea'}
                              <textarea class="field min-h-20" name={field.key}>{String(row[field.key] ?? '')}</textarea>
                            {:else if field.kind === 'boolean'}
                              <span class="flex items-center gap-2">
                                <input class="h-4 w-4" type="checkbox" name={field.key} value="true" checked={row[field.key] === true} />
                                <span class="text-[var(--muted)]">Ativado</span>
                              </span>
                            {:else if field.kind === 'file'}
                              <input class="field" name={field.key} type="file" />
                            {:else if field.kind === 'select'}
                              <select class="field" name={field.key} value={String(row[field.key] ?? '')} required={field.required}>
                                <option value="">Selecione</option>
                                {#if field.source === 'motorcycles'}
                                  {#each motorcycles as motorcycle}
                                    <option value={motorcycle.id}>{motorcycle.name} · {motorcycle.brand} {motorcycle.model}</option>
                                  {/each}
                                {:else}
                                  {#each field.options ?? [] as option}
                                    <option value={option.value}>{option.label}</option>
                                  {/each}
                                {/if}
                              </select>
                            {:else}
                              <input
                                class="field"
                                name={field.key}
                                value={String(row[field.key] ?? '')}
                                type={field.kind === 'date' ? 'date' : field.kind === 'number' || field.kind === 'money' ? 'number' : 'text'}
                                step={field.kind === 'money' ? '0.01' : 'any'}
                                required={field.required}
                              />
                            {/if}
                          </label>
                        {/each}
                        <div class="flex items-end">
                          <button class="button-primary" type="submit">Salvar alterações</button>
                        </div>
                      </form>
                    </details>
                  </td>
                </tr>
            {:else}
              <tr>
                <td class="px-4 py-16 text-center" colspan={feature.listColumns.length + 2}>
                  <p class="label-tech text-[var(--accent)]">Nada por aqui ainda</p>
                  <p class="mt-2 text-sm text-[var(--muted)]">Use o formulário ao lado para criar o primeiro registro.</p>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <form class="panel relative grid gap-3 overflow-hidden p-4" method="POST" enctype="multipart/form-data" use:enhance>
      <div class="corner-slashes" aria-hidden="true"></div>
      <div class="relative">
        <p class="label-tech text-[var(--accent)]">Novo</p>
        <h2 class="display mt-1 text-2xl">Novo registro</h2>
        <p class="mt-1 text-sm text-[var(--muted)]">Validação server-side com Supabase RLS.</p>
      </div>
      {#each feature.fields as field}
        <label class="grid gap-1 text-sm">
          <span class="font-semibold">{field.label}</span>
          {#if field.kind === 'textarea'}
            <textarea class="field min-h-24" name={field.key} required={field.required}></textarea>
          {:else if field.kind === 'boolean'}
            <span class="flex items-center gap-2">
              <input class="h-4 w-4" type="checkbox" name={field.key} value="true" />
              <span class="text-[var(--muted)]">Ativado</span>
            </span>
          {:else if field.kind === 'file'}
            <input class="field" name={field.key} type="file" required={field.required} />
          {:else if field.kind === 'select'}
            <select class="field" name={field.key} required={field.required}>
              <option value="">Selecione</option>
              {#if field.source === 'motorcycles'}
                {#each motorcycles as motorcycle}
                  <option value={motorcycle.id}>{motorcycle.name} · {motorcycle.brand} {motorcycle.model}</option>
                {/each}
              {:else}
                {#each field.options ?? [] as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              {/if}
            </select>
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

<style>
  /* A tint derived from --fg, so it lightens the row in dark mode instead of
     painting black-on-black like the old bg-black/[0.015] did. */
  .edit-row {
    background: color-mix(in srgb, var(--fg) 3%, transparent);
  }

  .row-hover:hover {
    background: color-mix(in srgb, var(--accent) 4%, transparent);
  }

  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    pointer-events: none;
    opacity: 0.15;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }
</style>
