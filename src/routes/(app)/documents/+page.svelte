<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
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
          ? "Lembrete criado."
          : String(
              "data" in result && result.data?.message
                ? result.data.message
                : "Não foi possível criar o lembrete.",
            );
      await update();
    };
  };
</script>

<section aria-busy={formBusy}>
  <FeaturePage
    {...data}
    errorMessage={!form?.ok
      ? form?.message || data.errorMessage
      : data.errorMessage}
  />
  {#if statusMessage}
    <p
      class={statusRole === "alert"
        ? "mt-6 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        : "mt-6 rounded border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"}
      role={statusRole}
      aria-live={statusRole === "alert" ? "assertive" : "polite"}
    >
      {statusMessage}
    </p>
  {/if}
</section>
<div class="mt-6 grid gap-2 md:grid-cols-2">
  {#each data.rows as document}<article
      class="panel flex min-w-0 flex-wrap items-center justify-between gap-3 p-4"
    >
      <span class="min-w-0 flex-1 break-words"
        >{document.name} · {document.valid_until ?? "sem validade"}</span
      >
      <form
        method="POST"
        action="?/createReminder"
        use:enhance={enhanceWithStatus}
      >
        <input type="hidden" name="id" value={String(document.id)} /><button
          class="button-secondary min-h-11"
          disabled={formBusy}>Criar lembrete</button
        >
      </form>
    </article>{/each}
</div>
