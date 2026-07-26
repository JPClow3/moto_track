<script lang="ts">
  import { enhance } from "$app/forms";
  export let data;
  export let form;

  let selectedTemplateId = "";
  let selectedBrand = "";
  let custom = false;
  $: brands = [...new Set(data.templates.map((template) => template.brand))];
  $: models = data.templates.filter(
    (template) => template.brand === selectedBrand,
  );
  $: selectedTemplate = data.templates.find(
    (template) => template.id === selectedTemplateId,
  );

  function selectBrand() {
    selectedTemplateId = "";
  }

  function templateLabel(template: (typeof data.templates)[number]) {
    const year =
      template.year_to && template.year_to !== template.year_from
        ? `${template.year_from}–${template.year_to}`
        : template.year_from;
    return `${template.model} ${template.variant} · ${year}`;
  }
</script>

<svelte:head><title>Garagem · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p class="eyebrow">
        <span class="slash-rule" aria-hidden="true"></span>Garagem
      </p>
      <h1 class="display text-4xl">Motos ativas e arquivadas</h1>
      <p class="mt-2 text-sm text-[var(--muted)]">
        Arquivar preserva todo o histórico e permite restauração posterior.
      </p>
    </div>
  </header>
  {#if form?.message}<p class="rounded bg-danger/10 p-3 text-sm text-danger">
      {form.message}
    </p>{/if}
  <div class="grid gap-6 xl:grid-cols-[1fr_340px]">
    <div class="grid gap-4 md:grid-cols-2">
      {#each data.motorcycles as motorcycle}
        <article class:opacity-70={!motorcycle.is_active} class="panel p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold">{motorcycle.name}</h2>
              <p class="text-sm text-[var(--muted)]">
                {motorcycle.brand}
                {motorcycle.model} · {motorcycle.year}
              </p>
            </div>
            <span
              class={`label-tech rounded-full px-2.5 py-1 text-xs ${motorcycle.is_active ? "bg-success/15 text-success" : "bg-[var(--muted)]/15 text-[var(--muted)]"}`}
              >{motorcycle.is_active ? "Ativa" : "Arquivada"}</span
            >
          </div>
          <p class="display numeric mt-4 text-4xl">
            {motorcycle.current_odometer_km}
            <span class="text-base font-medium">km</span>
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            {#if motorcycle.is_active}
              <form method="POST" action="?/archive" use:enhance>
                <input type="hidden" name="id" value={motorcycle.id} /><button
                  class="button-danger"
                  type="submit">Arquivar</button
                >
              </form>
            {:else}
              <form method="POST" action="?/restore" use:enhance>
                <input type="hidden" name="id" value={motorcycle.id} /><button
                  class="button-primary"
                  type="submit">Restaurar</button
                >
              </form>
            {/if}
          </div>
          {#if motorcycle.is_active}
            <details class="mt-4 border-t border-[var(--line)] pt-3">
              <summary class="cursor-pointer font-semibold"
                >Odômetro e especificações</summary
              >
              <form
                class="mt-3 grid gap-2"
                method="POST"
                action="?/updateOdometer"
                use:enhance
              >
                <input
                  type="hidden"
                  name="motorcycle_id"
                  value={motorcycle.id}
                /><label class="grid gap-1 text-sm"
                  >Odômetro atual<input
                    class="field"
                    name="odometer_override_km"
                    type="number"
                    min="0"
                    value={motorcycle.current_odometer_km}
                  /></label
                ><button class="button-secondary" type="submit"
                  >Atualizar odômetro</button
                >
              </form>
              <form
                class="mt-3 grid gap-2"
                method="POST"
                action="?/saveSpecs"
                use:enhance
              >
                <input
                  type="hidden"
                  name="motorcycle_id"
                  value={motorcycle.id}
                /><label class="text-sm"
                  >Pneu dianteiro<input
                    class="field"
                    name="tire_size_front"
                    value={motorcycle.motorcycle_specs?.[0]?.tire_size_front ??
                      ""}
                  /></label
                ><label class="text-sm"
                  >Pneu traseiro<input
                    class="field"
                    name="tire_size_rear"
                    value={motorcycle.motorcycle_specs?.[0]?.tire_size_rear ??
                      ""}
                  /></label
                ><label class="text-sm"
                  >Manual<input
                    class="field"
                    name="manual_reference"
                    value={motorcycle.motorcycle_specs?.[0]?.manual_reference ??
                      ""}
                  /></label
                ><button class="button-secondary" type="submit"
                  >Salvar especificações</button
                >
              </form>
            </details>
          {/if}
          {#if motorcycle.manual_source}
            <div class="mt-4 border-t border-[var(--line)] pt-4">
              <p class="label-tech text-[var(--accent)]">Fonte da agenda</p>
              <a
                class="mt-1 block text-sm font-semibold text-brand underline-offset-4 hover:underline"
                href={motorcycle.manual_source.official_url}
                target="_blank"
                rel="noreferrer"
                >{motorcycle.manual_source.document_version} ↗</a
              >
              <p class="mt-1 text-xs text-[var(--muted)]">
                {motorcycle.manual_source.page_reference} · verificado em
                {motorcycle.manual_source.last_verified_date}
              </p>
              <p class="mt-1 text-xs text-[var(--muted)]">
                {motorcycle.manual_source.coverage_notes}
              </p>
            </div>
          {/if}
          {#if motorcycle.template_documents.length}
            <div class="mt-4 border-t border-[var(--line)] pt-3">
              <p class="label-tech text-xs text-[var(--muted)]">
                Documentação oficial
              </p>
              {#each motorcycle.template_documents as document}
                <a
                  class="mt-1 block text-sm font-semibold text-brand underline-offset-4 hover:underline"
                  href={document.external_url}
                  target="_blank"
                  rel="noreferrer">{document.title} ↗</a
                >
                <p class="mt-1 text-xs text-[var(--muted)]">{document.notes}</p>
              {/each}
            </div>
          {/if}
        </article>
      {:else}<p class="panel p-6 text-[var(--muted)]">
          Sua garagem está vazia. Cadastre a primeira moto.
        </p>{/each}
    </div>
    <form
      class="panel grid gap-3 p-5"
      method="POST"
      action="?/create"
      use:enhance
    >
      <h2 class="text-lg font-bold">Nova moto</h2>
      <label class="text-sm">
        Nome<input class="field" name="name" required />
      </label>
      <label class="flex items-center gap-2 text-sm font-semibold">
        <input bind:checked={custom} type="checkbox" /> Cadastro personalizado
      </label>
      {#if !custom}
        <label class="text-sm">
          Marca<select
            class="field"
            bind:value={selectedBrand}
            on:change={selectBrand}
            required
          >
            <option value="" disabled>Selecione</option>
            {#each brands as brand}
              <option value={brand}>{brand}</option>
            {/each}
          </select>
        </label>
        <label class="text-sm">
          Modelo<select
            class="field"
            name="template_id"
            bind:value={selectedTemplateId}
            required
            disabled={!selectedBrand}
          >
            <option value="" disabled>Selecione</option>
            {#each models as template}
              <option value={template.id}>{templateLabel(template)}</option>
            {/each}
          </select>
        </label>
        {#if selectedTemplate}
          <p class="text-xs text-[var(--muted)]">
            {selectedTemplate.model}
            {selectedTemplate.variant} · {selectedTemplate.generation}
            · {selectedTemplate.year_from}. {selectedTemplate.maintenance_count} itens
            com fonte oficial.
          </p>
          {#if selectedTemplate.manual_url}
            <a
              class="text-xs font-semibold text-brand underline-offset-4 hover:underline"
              href={selectedTemplate.manual_url}
              target="_blank"
              rel="noreferrer"
              >{selectedTemplate.document_version} · {selectedTemplate.page_reference}
              ↗</a
            >
          {/if}
        {/if}
        <input
          type="hidden"
          name="brand"
          value={selectedTemplate?.brand ?? ""}
        />
        <input
          type="hidden"
          name="model"
          value={selectedTemplate?.model ?? ""}
        />
      {:else}
        <input type="hidden" name="template_id" value="" />
        <label class="text-sm">
          Marca<input class="field" name="brand" required={custom} />
        </label>
        <label class="text-sm">
          Modelo<input class="field" name="model" required={custom} />
        </label>
      {/if}
      <label class="text-sm">
        Ano<input
          class="field"
          name="year"
          type="number"
          min={selectedTemplate?.year_from ?? 1901}
          max={selectedTemplate?.year_to ?? new Date().getFullYear()}
          required
        />
      </label>
      <label class="text-sm"
        >Odômetro<input
          class="field"
          name="current_odometer_km"
          type="number"
          min="0"
          value="0"
        /></label
      ><button
        class="button-primary"
        type="submit"
        disabled={!data.canAddActive}>Cadastrar moto</button
      >{#if !data.canAddActive}<p class="text-xs text-[var(--muted)]">
          O plano atual atingiu o limite de motos ativas.
        </p>{/if}
    </form>
  </div>
</section>
