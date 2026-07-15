<script lang="ts">
  import { CheckCircle2 } from 'lucide-svelte';
</script>

<svelte:head><title>Preços · Moto Track</title></svelte:head>

<div class="min-h-screen bg-[var(--bg)] relative overflow-hidden flex flex-col py-16 px-4 sm:px-6">
  <!-- Subtle Background Gradients -->
  <div class="absolute top-0 right-0 w-[60%] h-[60%] rounded-full bg-signal/10 blur-[120px] pointer-events-none z-0"></div>
  <div class="absolute bottom-0 left-0 w-[60%] h-[60%] rounded-full bg-moss/10 blur-[120px] pointer-events-none z-0"></div>

  <div class="max-w-7xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <p class="text-sm font-semibold uppercase tracking-wide text-signal mb-2">Moto Track Pro</p>
      <h1 class="text-4xl md:text-5xl font-black mb-4 text-ink dark:text-white">Escolha o seu plano</h1>
      <p class="text-lg text-[var(--muted)]">Planos acessíveis e sem surpresas. Comece de graça e faça o upgrade quando precisar de mais potência para a sua moto.</p>
    </div>
    
    <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
      <!-- Free Plan -->
      <div class="panel p-8 flex flex-col hover:border-[var(--muted)] transition-colors bg-[var(--bg)]/60 backdrop-blur-xl">
        <h3 class="text-2xl font-black mb-2 text-ink dark:text-white">Free</h3>
        <p class="text-[var(--muted)] text-sm h-10">Essencial para acompanhar uma moto sem custo.</p>
        <div class="my-6">
          <span class="text-5xl font-black text-ink dark:text-white">R$0</span>
        </div>
        <ul class="space-y-4 mb-8 flex-1">
          <li class="flex items-start gap-3 text-[var(--muted)] text-sm">
            <CheckCircle2 class="w-5 h-5 text-moss shrink-0" />
            <span>Gestão de <strong>1 moto ativa</strong></span>
          </li>
          <li class="flex items-start gap-3 text-[var(--muted)] text-sm">
            <CheckCircle2 class="w-5 h-5 text-moss shrink-0" />
            <span>Até 3 uploads de recibos/fotos</span>
          </li>
          <li class="flex items-start gap-3 text-[var(--muted)] text-sm">
            <CheckCircle2 class="w-5 h-5 text-moss shrink-0" />
            <span>3 lembretes ativos simultâneos</span>
          </li>
          <li class="flex items-start gap-3 text-[var(--muted)] text-sm">
            <CheckCircle2 class="w-5 h-5 text-moss shrink-0" />
            <span>3 turnos profissionais por mês</span>
          </li>
        </ul>
        <a class="button-secondary w-full py-3 flex items-center justify-center" href="/auth">Começar Grátis</a>
      </div>

      <!-- Pro Plan -->
      <div class="panel p-8 flex flex-col border-signal shadow-2xl relative overflow-hidden bg-[var(--bg)]/80 backdrop-blur-xl">
        <div class="absolute top-0 right-0 bg-signal text-ink font-bold text-xs uppercase tracking-wider px-3 py-1 rounded-bl-lg">
          Recomendado
        </div>
        <div class="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-signal to-moss"></div>
        
        <h3 class="text-2xl font-black mb-2 flex items-center gap-2 text-ink dark:text-white">Pro <span class="flex h-3 w-3"><span class="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-signal opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-signal"></span></span></h3>
        <p class="text-[var(--muted)] text-sm h-10">Sem limites para quem usa a moto como ferramenta principal.</p>
        <div class="my-6 flex items-center gap-2">
          <span class="text-5xl font-black text-signal">Stripe</span>
        </div>
        <ul class="space-y-4 mb-8 flex-1">
          <li class="flex items-start gap-3 text-sm font-medium">
            <CheckCircle2 class="w-5 h-5 text-signal shrink-0" />
            <span><strong>Motos ilimitadas</strong> na garagem</span>
          </li>
          <li class="flex items-start gap-3 text-sm font-medium">
            <CheckCircle2 class="w-5 h-5 text-signal shrink-0" />
            <span><strong>Uploads e anexos ilimitados</strong></span>
          </li>
          <li class="flex items-start gap-3 text-sm font-medium">
            <CheckCircle2 class="w-5 h-5 text-signal shrink-0" />
            <span><strong>Lembretes ilimitados</strong></span>
          </li>
          <li class="flex items-start gap-3 text-sm font-medium">
            <CheckCircle2 class="w-5 h-5 text-signal shrink-0" />
            <span><strong>Turnos ilimitados</strong> para profissionais</span>
          </li>
          <li class="flex items-start gap-3 text-sm font-medium">
            <CheckCircle2 class="w-5 h-5 text-signal shrink-0" />
            <span>Relatórios avançados de venda com selo Pro</span>
          </li>
        </ul>
        <a class="button-primary w-full bg-signal text-ink hover:bg-signal/80 py-3 shadow-lg shadow-signal/20 flex items-center justify-center" href="/billing/checkout">Assinar Pro</a>
      </div>
    </div>
  </div>
</div>
