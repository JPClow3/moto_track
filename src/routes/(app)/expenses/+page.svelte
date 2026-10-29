<script lang="ts">
  import { appCopy } from "$lib/i18n/app-copy";
  import FeaturePage from "$components/FeaturePage.svelte";
  import RecordSheet from "$lib/components/app/RecordSheet.svelte";
  import type { ActionChoice } from "$lib/components/app/ActionMenu.svelte";
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { locale, t } from "$lib/i18n/store";
  import { formatDate, formatMoney, type MessageKey } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import StatusBadge from "$components/ui/StatusBadge.svelte";
  import { showToast } from "$components/ui/toast";
  import { VehicleTax } from "$components/icons";
  import Plus from "lucide-svelte/icons/plus";
  import { afterNavigate, replaceState } from "$app/navigation";

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
  // With no fees, policies or claims the page is one empty state; the
  // insurance panels only appear once there is something to list.
  $: hasInsurance = hasPolicies || data.claims.length > 0;

  let formBusy = false;
  let errorStatus = "";
  let confirmDialog: ConfirmDialog;
  let featurePage: FeaturePage;
  let policySheet: RecordSheet;
  let claimSheet: RecordSheet;

  // Quick-log deep link: /expenses?new=1 opens the "new expense" sheet, then
  // drops the param so a reload or back navigation does not reopen it.
  // afterNavigate (not onMount) also catches the global quick-log while the
  // rider is already on /expenses.
  afterNavigate(({ to }) => {
    const url = to?.url;
    if (!url || url.searchParams.get("new") !== "1") return;
    if (data.motorcycles.length > 0) featurePage?.openCreate();
    const clean = new URL(url);
    clean.searchParams.delete("new");
    // The router finishes initialising after the first afterNavigate pass.
    setTimeout(() => {
      try {
        replaceState(`${clean.pathname}${clean.search}${clean.hash}`, {});
      } catch {
        history.replaceState(history.state, "", clean);
      }
    }, 0);
  });

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

  const finishStatus = (
    result: {
      type: string;
      data?: { message?: unknown };
    },
    successKey: MessageKey,
  ) => {
    if (result.type === "success") {
      policySheet?.close();
      claimSheet?.close();
      showToast($t(successKey));
    } else {
      errorStatus = String(result.data?.message ?? $t("error.serverBody"));
    }
  };

  const enhanceSave: SubmitFunction = () => {
    formBusy = true;
    errorStatus = "";
    return async ({ result, update }) => {
      formBusy = false;
      finishStatus(result, "recordsUx.saved");
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
    errorStatus = "";
    return async ({ result, update }) => {
      formBusy = false;
      if (result.type === "success") showToast($t("recordsUx.deleted"));
      await update();
    };
  };

  const shortDate = (value: unknown) =>
    value ? formatDate($locale, String(value).slice(0, 10)) : "";
</script>

<section class="grid gap-6" aria-busy={formBusy}>
  <FeaturePage
    bind:this={featurePage}
    routeSlug="expenses"
    feature={localizedFeature}
    rows={data.rows}
    motorcycles={data.motorcycles}
    {actionChoices}
    on:actionSelect={handleActionSelect}
    errorMessage={!form?.ok
      ? form?.message || data.errorMessage
      : data.errorMessage}
    emptyIcon={VehicleTax}
    emptyTitle={$t("recordsUx.expensesEmpty")}
  />
  <ConfirmDialog
    bind:this={confirmDialog}
    confirmLabel={$t("common.delete")}
    destructive
  />

  <!-- Sheet for New Insurance Policy -->
  <RecordSheet
    bind:this={policySheet}
    title={$t("authenticatedUx.addPolicy")}
    description={$t("authenticatedUx.addPolicyDesc")}
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-3"
      method="POST"
      action="?/savePolicy"
      use:enhance={enhanceSave}
    >
      {#if errorStatus}
        <!-- Failures stay inside the open sheet; deletes surface through
             FeaturePage's page-level alert (form.message). -->
        <p
          class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          {errorStatus}
        </p>
      {/if}
      <div class="field-group">
        <label class="field-label" for="expense-policy-motorcycle"
          >{appCopy($locale, "Moto")}</label
        >
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
          >{appCopy($locale, "Seguradora")}</label
        >
        <input
          class="field"
          id="expense-policy-provider"
          name="provider"
          placeholder={appCopy($locale, "Ex: Porto Seguro")}
          required
        />
      </div>

      <div class="field-group">
        <label class="field-label" for="expense-policy-number"
          >{appCopy($locale, "Apólice")}</label
        >
        <input
          class="field"
          id="expense-policy-number"
          name="policy_number"
          placeholder={appCopy($locale, "Número da apólice")}
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="field-group">
          <label class="field-label" for="expense-policy-start"
            >{appCopy($locale, "Início da cobertura")}</label
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
            >{appCopy($locale, "Fim da cobertura")}</label
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
            >{appCopy($locale, "Prêmio (R$)")}</label
          >
          <input
            class="field"
            id="expense-policy-premium"
            name="premium"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder={$locale === "en" ? "0.00" : "0,00"}
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="expense-policy-notify"
            >{appCopy($locale, "Avisar antes (dias)")}</label
          >
          <input
            class="field"
            id="expense-policy-notify"
            name="notify_before_days"
            type="number"
            inputmode="numeric"
            min="0"
            step="1"
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
    closeLabel={$t("authenticatedUx.close")}
  >
    <form
      class="grid gap-3"
      method="POST"
      action="?/saveClaim"
      use:enhance={enhanceSave}
    >
      {#if errorStatus}
        <!-- Failures stay inside the open sheet; deletes surface through
             FeaturePage's page-level alert (form.message). -->
        <p
          class="rounded border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          {errorStatus}
        </p>
      {/if}
      {#if !hasPolicies}
        <p class="text-sm text-[var(--muted)]">
          {$t("expenses.claimNeedsPolicy")}
        </p>
      {/if}

      <div class="field-group">
        <label class="field-label" for="expense-claim-policy"
          >{appCopy($locale, "Seguro")}</label
        >
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
          >{appCopy($locale, "Data do sinistro")}</label
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
          >{appCopy($locale, "Descrição")}</label
        >
        <input
          class="field"
          id="expense-claim-description"
          name="description"
          placeholder={appCopy($locale, "Ex: Queda lateral, reparo carenagem")}
          required
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="field-group">
          <label class="field-label" for="expense-claim-amount"
            >{appCopy($locale, "Valor (R$)")}</label
          >
          <input
            class="field"
            id="expense-claim-amount"
            name="amount"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder={$locale === "en" ? "0.00" : "0,00"}
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="expense-claim-status">Status</label>
          <select class="field" id="expense-claim-status" name="status">
            <option value="open">{appCopy($locale, "Aberto")}</option>
            <option value="settled">{appCopy($locale, "Resolvido")}</option>
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
  {#if hasInsurance || data.rows.length > 0}
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
            <Plus size={16} aria-hidden="true" />
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
                  {$t("expenses.policyDue", {
                    date: shortDate(p.coverage_end),
                  })} · {brl(p.premium_cents ?? 0)}
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
            <Plus size={16} aria-hidden="true" />
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
                    : appCopy($locale, "Seguro")}
                  · {shortDate(claim.claim_date)}
                </p>
                <p class="mt-0.5 text-xs text-[var(--muted)]">
                  {claim.description} · {brl(claim.amount_cents ?? 0)}
                </p>
                <StatusBadge
                  class="mt-1.5"
                  tone={claim.status === "settled" ? "ok" : "info"}
                  >{claim.status === "settled"
                    ? $t("expenses.claimSettled")
                    : $t("expenses.claimOpen")}</StatusBadge
                >
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
  {/if}
</section>
