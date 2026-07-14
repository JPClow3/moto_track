<script lang="ts">
  export let data: { profile: Record<string, string> | null; requests: Array<Record<string, string>> };
</script>
<svelte:head><title>Conta · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <div>
    <p class="text-sm font-semibold uppercase tracking-wide text-signal">Billing</p>
    <h1 class="text-3xl font-bold">Conta e assinatura</h1>
  </div>
  <div class="panel p-5">
    <p class="text-sm text-[var(--muted)]">Plano atual</p>
    <p class="mt-2 text-3xl font-black">{data.profile?.plan ?? 'free'}</p>
    <div class="mt-4 flex gap-3">
      <a class="button-primary" href="/billing/checkout">Assinar Pro</a>
      <a class="button-secondary" href="/billing/portal">Portal Stripe</a>
    </div>
  </div>
  <div class="panel p-5">
    <h2 class="font-semibold">Dados pessoais</h2>
    <div class="mt-4 flex gap-3">
      <form method="POST" action="?/requestExport"><button class="button-secondary">Solicitar exportação</button></form>
      <form method="POST" action="?/requestDeletion"><button class="button-danger">Solicitar exclusão</button></form>
    </div>
  </div>
</section>
