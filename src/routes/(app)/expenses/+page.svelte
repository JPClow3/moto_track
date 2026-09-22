<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import type { ActionChoice } from "$lib/components/app/ActionMenu.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import Plus from "lucide-svelte/icons/plus";

  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const policyLabel = (policy: {
    provider: string;
    policy_number: string | null;
  }) =>
    `${policy.provider}${policy.policy_number ? ` · ${policy.policy_number}` : ""}`;

  $: localizedFeature = {
    ...data.feature,
    slug: $t("nav.expenses"),
    title: $t("expenses.pageTitle"),
    subtitle: $t("expenses.pageSubtitle"),
  };
  $: hasPolicies = data.policies.length > 0;

  let formBusy = false;
  let statusMessage = "";
  let statusRole: "status" | "alert" = "status";
  let confirmDialog: ConfirmDialog;
  let policySheet: RecordSheet;
  let claimSheet: RecordSheet;

  $: actionChoices = [
    {
      id: "expense-record",
      label: $t("authenticatedUx.addExpense"),
      description: $t("authenticatedUx.addExpenseDesc"),
      recommended: true,
    },
    {
      id: "expense-policy",
      label: $t("authenticatedUx.addPolicy"),
      description: $t("authenticatedUx.addPolicyDesc"),
    },
    {
      id: "expense-claim",
      label: $t("authenticatedUx.addClaim"),
      description: $t("authenticatedUx.addClaimDesc"),
    },
  ] satisfies ActionChoice[];

  function handleActionSelect(event: CustomEvent<string>) {
    const choice = event.detail;
    if (choice === "expense-policy") {
      policySheet?.open();
    } else if (choice === "expense-claim") {
      claimSheet?.open();
    }
  }

  const finishStatus = (result: {
    type: string;
    data?: { message?: unknown };
  }) => {
    if (result.type === "success") {
      statusRole = "status";
      statusMessage = $t("common.actionSuccess");
      policySheet?.close();
      claimSheet?.close();
    } else {
      statusRole = "alert";
      statusMessage = String(result.data?.message ?? $t("error.serverBody"));
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
    const ok = await confirmDialog.ask($t("feature.confirmDelete"));
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
    routeSlug="expenses"
    feature={localizedFeature}
    rows={data.rows}
    motorcycles={data.motorcycles}
    {actionChoices}
    on:actionSelect={handleActionSelect}
    errorMessage={!form?.ok
      ? form?.message || data.errorMessage
      : data.errorMessage}
  />
  <ConfirmDialog bind:this={confirmDialog} confirmLabel={$t("common.delete")} />
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

  <!-- Sheet for New Insurance Policy -->
  <RecordSheet
    bind:this={policySheet}
    title={$t("authenticatedUx.addPolicy")}
    description={$t("authenticatedUx.addPolicyDesc")}
    closeLabel={$t("authenticatedUx.close") || "Fechar"}
  >
    <form
      class="grid gap-3"
      method="POST"
      action="?/savePolicy"
      use:enhance={enhanceWithStatus}
    >
      <div class="field-group">
        <label class="field-label" for="expense-policy-motorcycle">Moto</label>
        <select
          class="field"
          id="expense-policy-motorcycle"
          name="motorcycle_id"
          required
        >
          <option value="">{$t("common.select")}</option>
          {#each data.motorcycles as m}
            <option value={m.id}>{m.name}</option>
          {/each}
        </select>
      </div>

      <div class="field-group">
        <label class="field-label" for="expense-policy-provider"
          >Seguradora</label
        >
        <input
          class="field"
          id="expense-policy-provider"
          name="provider"
          placeholder="Ex: Porto Seguro"
          required
        />
      </div>

      <div class="field-group">
        <label class="field-label" for="expense-policy-number">Apólice</label>
        <input
          class="field"
          id="expense-policy-number"
          name="policy_number"
          placeholder="Número da apólice"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="field-group">
          <label class="field-label" for="expense-policy-start"
            >Início da cobertura</label
          >
          <input
            class="field"
            id="expense-policy-start"
            name="coverage_start"
            type="date"
            required
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="expense-policy-end"
            >Fim da cobertura</label
          >
          <input
            class="field"
            id="expense-policy-end"
            name="coverage_end"
            type="date"
            required
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="field-group">
          <label class="field-label" for="expense-policy-premium"
            >Prêmio (R$)</label
          >
          <input
            class="field"
            id="expense-policy-premium"
            name="premium"
            type="number"
            step=".01"
            placeholder="0,00"
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="expense-policy-notify"
            >Avisar antes (dias)</label
          >
          <input
            class="field"
            id="expense-policy-notify"
            name="notify_before_days"
            type="number"
            value="30"
          />
        </div>
      </div>

      <button
        class="button-primary mt-2 min-h-11"
        type="submit"
        disabled={formBusy}
      >
        {$t("common.save")}
      </button>
    </form>
  </RecordSheet>

  <!-- Sheet for New Insurance Claim -->
  <RecordSheet
    bind:this={claimSheet}
    title={$t("authenticatedUx.addClaim")}
    description={$t("authenticatedUx.addClaimDesc")}
    closeLabel={$t("authenticatedUx.close") || "Fechar"}
  >
    <form
      class="grid gap-3"
      method="POST"
      action="?/saveClaim"
      use:enhance={enhanceWithStatus}
    >
      {#if !hasPolicies}
        <p class="text-sm text-[var(--muted)]">
          {$t("expenses.claimNeedsPolicy")}
        </p>
      {/if}

      <div class="field-group">
        <label class="field-label" for="expense-claim-policy">Seguro</label>
        <select
          class="field"
          id="expense-claim-policy"
          name="policy_id"
          required
          disabled={!hasPolicies}
        >
          <option value="">{$t("common.select")}</option>
          {#each data.policies as p}
            <option value={p.id}>{policyLabel(p)}</option>
          {/each}
        </select>
      </div>

      <div class="field-group">
        <label class="field-label" for="expense-claim-date"
          >Data do sinistro</label
        >
        <input
          class="field"
          id="expense-claim-date"
          name="claim_date"
          type="date"
          required
        />
      </div>

      <div class="field-group">
        <label class="field-label" for="expense-claim-description"
          >Descrição</label
        >
        <input
          class="field"
          id="expense-claim-description"
          name="description"
          placeholder="Ex: Queda lateral, reparo carenagem"
          required
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="field-group">
          <label class="field-label" for="expense-claim-amount"
            >Valor (R$)</label
          >
          <input
            class="field"
            id="expense-claim-amount"
            name="amount"
            type="number"
            step=".01"
            placeholder="0,00"
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="expense-claim-status">Status</label>
          <select class="field" id="expense-claim-status" name="status">
            <option value="open">Aberto</option>
            <option value="settled">Resolvido</option>
          </select>
        </div>
      </div>

      <button
        class="button-primary mt-2 min-h-11"
        type="submit"
        disabled={formBusy || !hasPolicies}
      >
        {$t("common.save")}
      </button>
    </form>
  </RecordSheet>

  <!-- Secondary sections: Policies and Claims -->
  <div class="grid gap-6 lg:grid-cols-2">
    <!-- Policies Section -->
    <div class="panel grid gap-3 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="display text-xl">{$t("expenses.policiesHeading")}</h2>
        <button
          type="button"
          class="button-secondary flex min-h-11 items-center gap-1 px-2 py-1 text-xs"
          on:click={() => policySheet?.open()}
        >
          <Plus size={14} />
          {$t("authenticatedUx.addPolicy")}
        </button>
      </div>
      <div class="mt-2 grid gap-2">
        {#each data.policies as p (p.id)}
          <article
            class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3"
          >
            <div class="min-w-0 flex-1 break-words">
              <p class="text-sm font-medium">{policyLabel(p)}</p>
              <p class="text-xs text-[var(--muted)]">
                {$t("expenses.policyDue", { date: p.coverage_end })} · {brl(
                  p.premium_cents ?? 0,
                )}
              </p>
            </div>
            <form
              method="POST"
              action="?/deletePolicy"
              use:enhance={enhanceDelete}
            >
              <input type="hidden" name="id" value={p.id} />
              <button
                class="button-danger min-h-11 px-2 py-1 text-xs"
                disabled={formBusy}
              >
                {$t("common.delete")}
              </button>
            </form>
          </article>
        {:else}
          <p class="p-4 text-center text-sm text-[var(--muted)]">
            {$t("expenses.emptyPolicies")}
          </p>
        {/each}
      </div>
    </div>

    <!-- Claims Section -->
    <div class="panel grid gap-3 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="display text-xl">{$t("expenses.claimsHeading")}</h2>
        <button
          type="button"
          class="button-secondary flex min-h-11 items-center gap-1 px-2 py-1 text-xs"
          disabled={!hasPolicies}
          on:click={() => claimSheet?.open()}
        >
          <Plus size={14} />
          {$t("authenticatedUx.addClaim")}
        </button>
      </div>
      <div class="mt-2 grid gap-2">
        {#each data.claims as claim (claim.id)}
          <article
            class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-3"
          >
            <div class="min-w-0 flex-1 break-words">
              <p class="text-sm font-medium">
                {claim.insurance_policies
                  ? policyLabel(claim.insurance_policies)
                  : "Seguro"}
                · {claim.claim_date}
              </p>
              <p class="mt-0.5 text-xs text-[var(--muted)]">
                {claim.description} · {brl(claim.amount_cents ?? 0)} · {claim.status ===
                "settled"
                  ? $t("expenses.claimSettled")
                  : $t("expenses.claimOpen")}
              </p>
            </div>
            <form
              method="POST"
              action="?/deleteClaim"
              use:enhance={enhanceDelete}
            >
              <input type="hidden" name="id" value={claim.id} />
              <button
                class="button-danger min-h-11 px-2 py-1 text-xs"
                disabled={formBusy}
              >
                {$t("common.delete")}
              </button>
            </form>
          </article>
        {:else}
          <p class="p-4 text-center text-sm text-[var(--muted)]">
            {$t("expenses.emptyClaims")}
          </p>
        {/each}
      </div>
    </div>
  </div>
</section>
