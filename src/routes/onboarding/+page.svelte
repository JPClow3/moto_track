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
</script>

<section class="mx-auto grid max-w-xl gap-6">
  <header>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>Primeiros passos
    </p>
    <h1 class="display text-4xl">Vamos conhecer sua moto</h1>
  </header>
  {#if form?.message}<p class="rounded bg-danger/10 p-3 text-sm text-danger">
      {form.message}
    </p>{/if}
  <form
    method="POST"
    action="?/create"
    use:enhance
    class="panel grid gap-3 p-5"
  >
    <label class="text-sm">
      Nome<input class="field" name="name" required />
    </label>
    <div class="border-y border-[var(--line)] py-3">
      <label class="flex items-center gap-2 text-sm font-semibold">
        <input bind:checked={custom} type="checkbox" /> Não encontrei minha moto no
        catálogo
      </label>
      {#if !custom}
        <p class="mt-1 text-xs text-[var(--muted)]">
          Catálogo inicial: os 10 modelos/famílias mais presentes nas vendas
          brasileiras dos últimos 20 anos.
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
                <option value={template.id}>{template.model}</option>
              {/each}
            </select>
          </label>
        </div>
        {#if selectedTemplate}
          <p class="mt-2 text-xs text-[var(--muted)]">
            Disponível de {selectedTemplate.year_from} a {selectedTemplate.year_to ??
              "hoje"}. {selectedTemplate.maintenance_count} lembretes de manutenção
            serão adicionados à garagem.
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
            Marca<input class="field" name="brand" required={custom} />
          </label>
          <label class="text-sm">
            Modelo<input class="field" name="model" required={custom} />
          </label>
        </div>
      {/if}
    </div>
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
    <label class="text-sm">
      Odômetro atual<input
        class="field"
        name="current_odometer_km"
        type="number"
        min="0"
        value="0"
      />
      <span class="mt-1 block text-xs text-[var(--muted)]">
        Usamos este valor para começar o plano no próximo marco do manual.
      </span>
    </label>
    <button class="button-primary" type="submit">Criar minha moto</button>
  </form>
  <form method="POST" action="?/demo" use:enhance>
    <button class="button-secondary w-full" type="submit"
      >Explorar com moto de demonstração</button
    >
  </form>
</section>
