<script lang="ts">
  import FeaturePage from "$components/FeaturePage.svelte";
  import { enhance } from "$app/forms";
  import { locale } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";
  export let data;
  export let form;

  const brl = (cents: number) => formatMoney($locale, cents);
  const policyLabel = (policy: {
    provider: string;
    policy_number: string | null;
  }) =>
    `${policy.provider}${policy.policy_number ? ` · ${policy.policy_number}` : ""}`;
</script>

<section class="grid gap-6">
  <FeaturePage {...data} errorMessage={form?.message || data.errorMessage} />
  <div class="grid gap-6 lg:grid-cols-2">
    <form
      class="panel grid gap-2 p-5"
      method="POST"
      action="?/savePolicy"
      use:enhance
    >
      <h2 class="font-bold">Seguro</h2>
      <select class="field" name="motorcycle_id" required
        ><option value="">Moto</option>{#each data.motorcycles as m}<option
            value={m.id}>{m.name}</option
          >{/each}</select
      ><input
        class="field"
        name="provider"
        placeholder="Seguradora"
        required
      /><input class="field" name="policy_number" placeholder="Apólice" /><input
        class="field"
        name="coverage_start"
        type="date"
        required
      /><input class="field" name="coverage_end" type="date" required /><input
        class="field"
        name="premium"
        type="number"
        step=".01"
        placeholder="Prêmio"
      /><input
        class="field"
        name="notify_before_days"
        type="number"
        value="30"
      /><button class="button-primary">Salvar seguro</button>
    </form>
    <form
      class="panel grid gap-2 p-5"
      method="POST"
      action="?/saveClaim"
      use:enhance
    >
      <h2 class="font-bold">Sinistro</h2>
      <select class="field" name="policy_id" required
        ><option value="">Seguro</option>{#each data.policies as p}<option
            value={p.id}>{policyLabel(p)}</option
          >{/each}</select
      ><input class="field" name="claim_date" type="date" required /><input
        class="field"
        name="description"
        placeholder="Descrição"
        required
      /><input
        class="field"
        name="amount"
        type="number"
        step=".01"
        placeholder="Valor"
      /><select class="field" name="status"
        ><option value="open">Aberto</option><option value="settled"
          >Resolvido</option
        ></select
      ><button class="button-secondary">Registrar sinistro</button>
    </form>
  </div>
  <div class="grid gap-2">
    <h2 class="display text-2xl">Apólices</h2>
    {#each data.policies as p}
      <article class="panel flex justify-between gap-3 p-4">
        <span
          >{policyLabel(p)} · vence {p.coverage_end} · {brl(
            p.premium_cents ?? 0,
          )}</span
        >
        <form method="POST" action="?/deletePolicy" use:enhance>
          <input type="hidden" name="id" value={p.id} /><button
            class="button-danger">Excluir</button
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
      <article class="panel flex justify-between gap-3 p-4">
        <div>
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
        <form method="POST" action="?/deleteClaim" use:enhance>
          <input type="hidden" name="id" value={claim.id} /><button
            class="button-danger">Excluir</button
          >
        </form>
      </article>
    {:else}
      <p class="text-sm text-[var(--muted)]">Nenhum sinistro registrado.</p>
    {/each}
  </div>
</section>
