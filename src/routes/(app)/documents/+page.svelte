<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  export let data;
</script>

<FeaturePage {...data} />
<div class="mt-6 grid gap-2 md:grid-cols-2">
  {#each data.rows as document}<article
      class="panel flex items-center justify-between gap-3 p-4"
    >
      <span>{document.name} · {document.valid_until ?? "sem validade"}</span>
      <form method="POST" action="?/createReminder" use:enhance>
        <input type="hidden" name="id" value={String(document.id)} /><button
          class="button-secondary">Criar lembrete</button
        >
      </form>
    </article>{/each}
</div>
