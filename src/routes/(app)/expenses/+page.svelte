<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const policyLabel = (policy: {
    provider: string;
    policy_number: string | null;
  }) =>
    `${policy.provider}${policy.policy_number ? ` · ${policy.policy_number}` : ""}`;

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown };
  }) => {
    if (result.type === "success") {
      statusRole = "status";
      statusMessage = "Operação concluída.";
    } else {
      statusRole = "alert";
      statusMessage = String(
        result.data?.message ?? "Não foi possível concluir.",
      );
    }
  };

  const enhanceWithStatus: SubmitFunction = () => {
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };

  const enhanceDelete: SubmitFunction = async ({ cancel }) => {
    const ok = await confirmDialog.ask(
      "Excluir este item? Esta ação não pode ser desfeita.",
    );
    if (!ok) {
      cancel();
      return;
    }
    formBusy = true;
    statusMessage = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result);
      await update();
    };
  };
</script>

<section class="grid gap-6" aria-busy={formBusy}>
  <FeaturePage
    {...data}
    errorMessage={!form?.ok
      ? form?.message || data.errorMessage
      : data.errorMessage}
  />
  <ConfirmDialog bind:this={confirmDialog} confirmLabel="Excluir" />
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
  <div class="grid gap-6 lg:grid-cols-2">
    <form
      class="panel grid gap-2 p-5"
      method="POST"
      action="?/savePolicy"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="font-bold">Seguro</h2>
      <label class="field-label" for="expense-policy-motorcycle">Moto</label>
      <select
        class="field"
        id="expense-policy-motorcycle"
        name="motorcycle_id"
        required
        ><option value="">Moto</option>{#each data.motorcycles as m}<option
            value={m.id}>{m.name}</option
          >{/each}</select
      ><label class="field-label" for="expense-policy-provider"
        >Seguradora</label
      ><input
        class="field"
        id="expense-policy-provider"
        name="provider"
        placeholder="Seguradora"
        required
      /><label class="field-label" for="expense-policy-number">Apólice</label
      ><input
        class="field"
        id="expense-policy-number"
        name="policy_number"
        placeholder="Apólice"
      /><label class="field-label" for="expense-policy-start"
        >Início da cobertura</label
      ><input
        class="field"
        id="expense-policy-start"
        name="coverage_start"
        type="date"
        required
      /><label class="field-label" for="expense-policy-end"
        >Fim da cobertura</label
      ><input
        class="field"
        id="expense-policy-end"
        name="coverage_end"
        type="date"
        required
      /><label class="field-label" for="expense-policy-premium">Prêmio</label
      ><input
        class="field"
        id="expense-policy-premium"
        name="premium"
        type="number"
        step=".01"
        placeholder="Prêmio"
      /><label class="field-label" for="expense-policy-notify"
        >Avisar antes (dias)</label
      ><input
        class="field"
        id="expense-policy-notify"
        name="notify_before_days"
        type="number"
        value="30"
      /><button class="button-primary" type="submit" disabled={formBusy}
        >Salvar seguro</button
      >
    </form>
    <form
      class="panel grid gap-2 p-5"
      method="POST"
      action="?/saveClaim"
      use:enhance={enhanceWithStatus}
    >
      <h2 class="font-bold">Sinistro</h2>
      <label class="field-label" for="expense-claim-policy">Seguro</label>
      <select class="field" id="expense-claim-policy" name="policy_id" required
        ><option value="">Seguro</option>{#each data.policies as p}<option
            value={p.id}>{policyLabel(p)}</option
          >{/each}</select
      ><label class="field-label" for="expense-claim-date"
        >Data do sinistro</label
      ><input
        class="field"
        id="expense-claim-date"
        name="claim_date"
        type="date"
        required
      /><label class="field-label" for="expense-claim-description"
        >Descrição</label
      ><input
        class="field"
        id="expense-claim-description"
        name="description"
        placeholder="Descrição"
        required
      /><label class="field-label" for="expense-claim-amount">Valor</label
      ><input
        class="field"
        id="expense-claim-amount"
        name="amount"
        type="number"
        step=".01"
        placeholder="Valor"
      /><label class="field-label" for="expense-claim-status">Status</label
      ><select class="field" id="expense-claim-status" name="status"
        ><option value="open">Aberto</option><option value="settled"
          >Resolvido</option
        ></select
      ><button class="button-secondary" type="submit" disabled={formBusy}
        >Registrar sinistro</button
      >
    </form>
  </div>
  <div class="grid gap-2">
    <h2 class="display text-2xl">Apólices</h2>
    {#each data.policies as p}
      <article class="panel flex min-w-0 flex-wrap justify-between gap-3 p-4">
        <span class="min-w-0 flex-1 break-words"
          >{policyLabel(p)} · vence {p.coverage_end} · {brl(
            p.premium_cents ?? 0,
          )}</span
        >
        <form method="POST" action="?/deletePolicy" use:enhance={enhanceDelete}>
          <input type="hidden" name="id" value={p.id} /><button
            class="button-danger min-h-11"
            disabled={formBusy}>Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhuma apólice cadastrada.</p>
    {/each}
  </div>
  <div class="grid gap-2">
    <h2 class="display text-2xl">Sinistros</h2>
    {#each data.claims as claim}
      <article class="panel flex min-w-0 flex-wrap justify-between gap-3 p-4">
        <div class="min-w-0 flex-1 break-words">
          <p class="font-medium">
            {claim.insurance_policies
              ? policyLabel(claim.insurance_policies)
              : "Seguro"}
            · {claim.claim_date}
          </p>
          <p class="mt-1 text-sm text-[var(--muted)]">
            {claim.description} · {brl(claim.amount_cents ?? 0)} · {claim.status ===
            "settled"
              ? "Resolvido"
              : "Aberto"}
          </p>
        </div>
        <form method="POST" action="?/deleteClaim" use:enhance={enhanceDelete}>
          <input type="hidden" name="id" value={claim.id} /><button
            class="button-danger min-h-11"
            disabled={formBusy}>Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhum sinistro registrado.</p>
    {/each}
  </div>
</section>
