<script lang="ts">
  import { enhance } from "$app/forms";
  export let data;
  export let form;

  let selectedTemplateId = "";
  let selectedBrand = "";
  let custom = false;
  let motorcycleName = "";
  let customBrand = "";
  let customModel = "";
  let selectedYear = "";
  let odometer = "0";
  let step = 1;
  let formElement: HTMLFormElement;

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

  function openHistory() {
    if (formElement.reportValidity()) step = 2;
  }
</script>

<section class="mx-auto grid max-w-xl gap-6">
  <header>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>Primeiros passos
    </p>
    <h1 class="display text-4xl">Vamos conhecer sua moto</h1>
  </header>
  {#if form?.message}<p
      class="rounded bg-danger/10 p-3 text-sm text-danger"
      role="alert"
      aria-live="assertive"
      tabindex="-1"
    >
      {form.message}
    </p>{/if}
  <form
    method="POST"
    action="?/create"
    use:enhance
    class="panel grid gap-3 p-5"
    bind:this={formElement}
  >
    <p class="label-tech text-[var(--accent)]" aria-live="polite">
      ETAPA {step} DE 2
    </p>
    {#if step === 1}
      <label class="text-sm">
        Nome<input
          class="field"
          name="name"
          bind:value={motorcycleName}
          required
        />
      </label>
      <div class="border-y border-[var(--line)] py-3">
        <label
          class="flex min-h-11 items-center gap-2 rounded px-2 text-sm font-semibold"
        >
          <input bind:checked={custom} type="checkbox" /> Não encontrei minha moto
          no catálogo
        </label>
        {#if !custom}
          <p class="mt-1 text-xs text-[var(--muted)]">
            Só mostramos agendas com manual oficial e cobertura exata de ano,
            geração e versão.
          </p>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
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
          </div>
          {#if selectedTemplate}
            <p class="mt-2 text-xs text-[var(--muted)]">
              {selectedTemplate.model}
              {selectedTemplate.variant} · {selectedTemplate.generation}
              · {selectedTemplate.year_from}. Fonte: {selectedTemplate.document_version},
              {selectedTemplate.page_reference}. Verificado em {selectedTemplate.last_verified_date}.
            </p>
            {#if selectedTemplate.manual_url}
              <a
                class="mt-2 inline-block text-xs font-semibold text-brand underline-offset-4 hover:underline"
                href={selectedTemplate.manual_url}
                target="_blank"
                rel="noreferrer">Abrir catálogo oficial de PDFs ↗</a
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
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <label class="text-sm">
              Marca<input
                class="field"
                name="brand"
                bind:value={customBrand}
                required={custom}
              />
            </label>
            <label class="text-sm">
              Modelo<input
                class="field"
                name="model"
                bind:value={customModel}
                required={custom}
              />
            </label>
          </div>
        {/if}
      </div>
      <label class="text-sm">
        Ano<input
          class="field"
          name="year"
          type="number"
          bind:value={selectedYear}
          min={selectedTemplate?.year_from ?? 1901}
          max={selectedTemplate?.year_to ?? new Date().getFullYear()}
          required
        />
      </label>
      <label class="text-sm">
        Odômetro atual<input
          class="field"
          name="current_odometer_km"
          type="number"
          min="0"
          bind:value={odometer}
        />
        <span class="mt-1 block text-xs text-[var(--muted)]">
          Este valor não será tratado como prova de que uma revisão anterior foi
          feita.
        </span>
      </label>
      <button class="button-primary" type="button" on:click={openHistory}
        >Continuar para o histórico</button
      >
    {:else}
      <input type="hidden" name="name" value={motorcycleName} />
      <input
        type="hidden"
        name="template_id"
        value={custom ? "" : selectedTemplateId}
      />
      <input
        type="hidden"
        name="brand"
        value={custom ? customBrand : (selectedTemplate?.brand ?? "")}
      />
      <input
        type="hidden"
        name="model"
        value={custom ? customModel : (selectedTemplate?.model ?? "")}
      />
      <input type="hidden" name="year" value={selectedYear} />
      <input type="hidden" name="current_odometer_km" value={odometer} />
      {#if selectedTemplate}
        <div class="grid gap-3">
          <div>
            <h2 class="display text-2xl">Histórico inicial</h2>
            <p class="mt-1 text-sm text-[var(--muted)]">
              Para cada serviço, diga o que você sabe. Não vamos inventar uma
              revisão passada: “não sei” vira atenção agora; “não foi feito”
              vira atrasado.
            </p>
          </div>
          {#each selectedTemplate.maintenance_items ?? [] as item (item.maintenance_type)}
            <fieldset class="rounded border border-[var(--line)] p-3">
              <legend class="px-1 text-sm font-semibold"
                >{item.maintenance_type}</legend
              >
              <p class="mb-2 text-xs text-[var(--muted)]">
                {item.interval_km
                  ? `Intervalo do manual: ${item.interval_km.toLocaleString("pt-BR")} km.`
                  : "Consulte o manual."}
              </p>
              <div class="grid gap-2 text-sm sm:grid-cols-3">
                <label class="flex min-h-11 items-center gap-2 rounded px-2"
                  ><input
                    type="radio"
                    name={`history_${item.maintenance_type}`}
                    value="confirmed_done"
                  /> Feito recentemente</label
                >
                <label class="flex min-h-11 items-center gap-2 rounded px-2"
                  ><input
                    type="radio"
                    name={`history_${item.maintenance_type}`}
                    value="not_done"
                  /> Não foi feito</label
                >
                <label class="flex min-h-11 items-center gap-2 rounded px-2"
                  ><input
                    type="radio"
                    name={`history_${item.maintenance_type}`}
                    value="unknown"
                    checked
                  /> Não sei confirmar</label
                >
              </div>
            </fieldset>
          {/each}
        </div>
      {:else}
        <p class="bg-[var(--muted)]/10 rounded p-3 text-sm">
          Sem uma agenda exata selecionada, a moto será criada sem recomendações
          automáticas.
        </p>
      {/if}
      <div class="flex gap-3">
        <button
          class="button-secondary"
          type="button"
          on:click={() => (step = 1)}>Voltar</button
        >
        <button class="button-primary flex-1" type="submit"
          >Criar minha moto</button
        >
      </div>
    {/if}
  </form>
  <form method="POST" action="?/demo" use:enhance>
    <button class="button-secondary w-full" type="submit"
      >Explorar com moto de demonstração</button
    >
  </form>
</section>
