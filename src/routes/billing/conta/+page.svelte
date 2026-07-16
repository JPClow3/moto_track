<script lang="ts">
  export let data: {
    profile: Record<string, string | boolean | null> | null;
    requests: Array<Record<string, string>>;
    checkout: string | null;
  };

  $: isPro = data.profile?.plan === "pro";
  $: hasStripeCustomer = Boolean(data.profile?.stripe_customer_id);
  $: isCancelling = data.profile?.cancel_at_period_end === true;
</script>

<svelte:head><title>Conta · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <div>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>Assinatura
    </p>
    <h1 class="display text-4xl">Conta e assinatura</h1>
  </div>
  <div class="panel p-5">
    {#if data.checkout === "success" && !isPro}
      <p
        class="bg-[var(--accent)]/10 mb-4 rounded-md p-3 text-sm text-[var(--fg)]"
      >
        Pagamento recebido. Estamos confirmando sua assinatura com a Stripe —
        atualize esta página em alguns instantes.
      </p>
    {:else if data.checkout === "cancelled"}
      <p
        class="mb-4 rounded-md bg-[var(--line)] p-3 text-sm text-[var(--muted)]"
      >
        Checkout cancelado. Nenhuma cobrança foi realizada.
      </p>
    {/if}
    <p class="text-sm text-[var(--muted)]">Plano atual</p>
    <p class="display mt-2 text-4xl uppercase">
      {data.profile?.plan ?? "free"}
    </p>
    {#if isPro}
      <p class="mt-2 text-sm text-[var(--muted)]">
        Cobrança {data.profile?.billing_interval === "yearly"
          ? "anual"
          : "mensal"}.
        {#if isCancelling}
          Seu plano permanece ativo até o fim do período atual.{/if}
      </p>
    {:else if data.profile?.stripe_subscription_status === "past_due"}
      <p class="mt-2 text-sm text-[var(--muted)]">
        Há um problema com o pagamento. Atualize sua forma de pagamento no
        portal Stripe.
      </p>
    {/if}
    <div class="mt-4 flex gap-3">
      {#if isPro}
        <a class="button-primary" href="/billing/portal">Gerenciar assinatura</a
        >
      {:else}
        <a class="button-primary" href="/precos">Assinar Pro</a>
        {#if hasStripeCustomer}
          <a class="button-secondary" href="/billing/portal"
            >Atualizar pagamento</a
          >
        {/if}
      {/if}
    </div>
  </div>
  <div class="panel p-5">
    <h2 class="font-semibold">Dados pessoais</h2>
    <div class="mt-4 flex gap-3">
      <form method="POST" action="?/requestExport">
        <button class="button-secondary">Solicitar exportação</button>
      </form>
      <form method="POST" action="?/requestDeletion">
        <button class="button-danger">Solicitar exclusão</button>
      </form>
    </div>
  </div>
</section>
