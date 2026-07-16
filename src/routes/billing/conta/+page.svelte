<script lang="ts">
  export let data: { profile: Record<string, string> | null; requests: Array<Record<string, string>> };
</script>
<svelte:head><title>Conta · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <div>
    <p class="eyebrow"><span class="slash-rule" aria-hidden="true"></span>Assinatura</p>
    <h1 class="display text-4xl">Conta e assinatura</h1>
  </div>
  <div class="panel p-5">
    <p class="text-sm text-[var(--muted)]">Plano atual</p>
    <p class="display mt-2 text-4xl uppercase">{data.profile?.plan ?? 'free'}</p>
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
