<script lang="ts">
  import { enhance } from "$app/forms";
  export let data;
  export let form;
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
    <label class="text-sm"
      >Nome<input class="field" name="name" required /></label
    ><label class="text-sm"
      >Marca<input class="field" name="brand" required /></label
    ><label class="text-sm"
      >Modelo<input class="field" name="model" required /></label
    ><label class="text-sm"
      >Ano<input class="field" name="year" type="number" required /></label
    ><label class="text-sm"
      >Template (opcional)<select class="field" name="template_id"
        ><option value="">Personalizada</option
        >{#each data.templates as template}<option value={template.id}
            >{template.brand} {template.model} {template.variant}</option
          >{/each}</select
      ></label
    ><button class="button-primary" type="submit">Criar minha moto</button>
  </form>
  <form method="POST" action="?/demo" use:enhance>
    <button class="button-secondary w-full" type="submit"
      >Explorar com moto de demonstração</button
    >
  </form>
</section>
