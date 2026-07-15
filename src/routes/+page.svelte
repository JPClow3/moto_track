<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { 
    Wrench, Droplet, Bell, Briefcase, FileText, CheckCircle2, Shield, ArrowRight 
  } from 'lucide-svelte';
  
  let visible = $state(false);
  onMount(() => {
    visible = true;
  });
</script>

<svelte:head>
  <title>Moto Track - Centro de Comando da sua Moto</title>
  <meta name="description" content="Controle de combustível, manutenção, pneus, documentos e lembretes para a sua moto." />
</svelte:head>

<!-- HERO WRAPPER -->
<div class="min-h-screen flex flex-col relative overflow-hidden bg-[var(--bg)]">
  <!-- Subtle Background Gradients -->
  <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-signal/15 blur-[100px] pointer-events-none z-0"></div>
  <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-moss/15 blur-[100px] pointer-events-none z-0"></div>

  <!-- Navigation -->
  <header class="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10 relative">
    <a href="/" class="flex items-center gap-2 transition hover:opacity-80">
      <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="h-7 sm:h-8 dark:hidden" />
      <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-7 sm:h-8 hidden dark:block" />
    </a>
    <div class="flex items-center gap-4">
      <a class="text-sm font-semibold hover:text-signal transition" href="/precos">Planos</a>
      <a class="button-primary shadow-lg shadow-ink/10" href="/auth">Entrar</a>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="flex-1 flex items-center z-10 relative">
    <section class="mx-auto grid max-w-7xl items-center gap-16 px-6 py-12 lg:grid-cols-[1.1fr_.9fr]">
      {#if visible}
        <div in:fly={{ y: 30, duration: 800, delay: 100 }}>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--panel)] border border-[var(--line)] text-xs font-semibold uppercase tracking-wider text-signal mb-6 shadow-sm">
            <span class="w-2 h-2 rounded-full bg-signal animate-pulse"></span>
            Bem-vindo ao Moto Track
          </div>
          
          <h1 class="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight text-ink dark:text-white">
            Seu <span class="text-transparent bg-clip-text bg-gradient-to-r from-signal to-moss">centro de comando</span> sobre duas rodas.
          </h1>
          
          <p class="mt-6 max-w-2xl text-lg sm:text-xl text-[var(--muted)] leading-relaxed">
            Acompanhe o histórico do hodômetro, custos, lembretes, documentos e revisões em um só lugar. Tenha o controle total da sua moto com um design premium e inteligente.
          </p>
          
          <div class="mt-10 flex flex-wrap gap-4 items-center">
            <a class="button-primary text-base px-8 py-3.5 shadow-xl shadow-ink/20 hover:shadow-ink/40 hover:-translate-y-1 transition-all duration-300" href="/auth">
              Começar Agora
            </a>
            <a class="button-secondary text-base px-8 py-3.5 hover:bg-[var(--line)]/30 transition-all duration-300" href="/precos">
              Ver Planos
            </a>
          </div>
          
          <!-- Features ticker -->
          <div class="mt-12 flex flex-wrap items-center gap-6 text-sm font-medium text-[var(--muted)] border-t border-[var(--line)] pt-6">
            <span class="flex items-center gap-2"><Droplet class="w-4 h-4 text-signal" /> Combustível</span>
            <span class="flex items-center gap-2"><Wrench class="w-4 h-4 text-signal" /> Manutenção</span>
            <span class="flex items-center gap-2"><CheckCircle2 class="w-4 h-4 text-signal" /> Pneus</span>
          </div>
        </div>
        
        <!-- Interactive Cards -->
        <div class="relative grid gap-6" in:fly={{ x: 30, duration: 800, delay: 300 }}>
          <!-- Main Card -->
          <div class="panel p-8 relative overflow-hidden group hover:border-signal/50 transition-colors duration-500">
            <div class="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-signal/10 to-transparent rounded-bl-full -z-10 group-hover:scale-125 transition-transform duration-700"></div>
            
            <div class="grid grid-cols-2 gap-6 relative z-10">
              <div class="rounded-xl border border-[var(--line)] p-5 bg-[var(--bg)]/60 backdrop-blur-md group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-300">
                <p class="text-sm font-medium text-[var(--muted)]">Saúde da Moto</p>
                <div class="mt-3 flex items-end gap-2">
                  <p class="text-5xl font-black text-ink dark:text-white">87</p>
                  <p class="text-sm font-bold text-moss mb-1">Bom</p>
                </div>
              </div>
              
              <div class="rounded-xl border border-[var(--line)] p-5 bg-[var(--bg)]/60 backdrop-blur-md group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-300">
                <p class="text-sm font-medium text-[var(--muted)]">Custo/km</p>
                <div class="mt-3 flex items-end gap-2">
                  <p class="text-4xl font-black text-ink dark:text-white">R$0,41</p>
                </div>
              </div>
            </div>
            
            <div class="mt-6 rounded-xl bg-gradient-to-br from-ink to-asphalt p-6 text-white shadow-xl relative overflow-hidden group-hover:-translate-y-1 transition-transform duration-300 border border-white/10">
              <div class="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                 <!-- abstract shape -->
                 <svg width="120" height="120" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="white" stroke-width="10" stroke-dasharray="20 10"/></svg>
              </div>
              <p class="text-sm font-medium text-white/70 relative z-10">Próximo Alerta</p>
              <div class="mt-2 flex items-center gap-3 relative z-10">
                <div class="p-2 bg-signal/20 rounded-lg text-signal backdrop-blur-sm">
                  <Bell class="w-5 h-5" />
                </div>
                <p class="text-xl font-bold">Troca de óleo em 340 km</p>
              </div>
            </div>
          </div>
          
          <!-- Decorative Floating Card -->
          <div class="absolute -bottom-6 -left-6 sm:-left-10 panel p-4 flex items-center gap-4 bg-[var(--panel)] shadow-2xl rounded-xl border border-[var(--line)] hover:border-moss/40 transition-colors animate-bounce" style="animation-duration: 4s;">
             <div class="w-10 h-10 rounded-full bg-moss/10 flex items-center justify-center text-moss">
               <Shield class="w-5 h-5" />
             </div>
             <div>
               <p class="text-sm font-bold text-ink dark:text-white">IPVA 2024</p>
               <p class="text-xs text-[var(--muted)]">Pago ontem</p>
             </div>
          </div>
        </div>
      {/if}
    </section>
  </main>
</div>

<!-- FEATURES SECTION -->
<section class="py-24 px-6 relative bg-[var(--panel)] border-t border-[var(--line)]">
  <div class="max-w-7xl mx-auto">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="text-4xl font-black mb-4">Tudo o que você precisa em um só lugar</h2>
      <p class="text-lg text-[var(--muted)]">Ferramentas projetadas para reduzir custos e manter sua moto sempre pronta para a pista ou para o asfalto.</p>
    </div>
    
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
      <div class="panel p-6 hover:-translate-y-2 transition-transform duration-300">
        <div class="w-12 h-12 rounded-xl bg-signal/10 flex items-center justify-center text-signal mb-6">
          <Droplet class="w-6 h-6" />
        </div>
        <h3 class="text-xl font-bold mb-2">Custos & Combustível</h3>
        <p class="text-[var(--muted)] text-sm leading-relaxed">Acompanhe cada abastecimento, visualize seu custo por KM e faça upload de recibos (com OCR em breve) com facilidade.</p>
      </div>

      <div class="panel p-6 hover:-translate-y-2 transition-transform duration-300">
        <div class="w-12 h-12 rounded-xl bg-moss/10 flex items-center justify-center text-moss mb-6">
          <Wrench class="w-6 h-6" />
        </div>
        <h3 class="text-xl font-bold mb-2">Manutenção</h3>
        <p class="text-[var(--muted)] text-sm leading-relaxed">Registre peças, serviços e desgaste dos pneus. Crie um histórico detalhado que agrega valor real na hora da revenda.</p>
      </div>

      <div class="panel p-6 hover:-translate-y-2 transition-transform duration-300">
        <div class="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger mb-6">
          <Bell class="w-6 h-6" />
        </div>
        <h3 class="text-xl font-bold mb-2">Lembretes</h3>
        <p class="text-[var(--muted)] text-sm leading-relaxed">Nunca mais esqueça uma troca de óleo ou IPVA. Configure lembretes baseados em quilometragem atual ou datas específicas.</p>
      </div>

      <div class="panel p-6 hover:-translate-y-2 transition-transform duration-300">
        <div class="w-12 h-12 rounded-xl bg-steel/10 flex items-center justify-center text-steel mb-6">
          <Briefcase class="w-6 h-6" />
        </div>
        <h3 class="text-xl font-bold mb-2">Uso Profissional</h3>
        <p class="text-[var(--muted)] text-sm leading-relaxed">Registra turnos de trabalho, receita diária e custos. Perfeito para motoboys que querem saber a lucratividade real do dia.</p>
      </div>
    </div>
  </div>
</section>

<!-- PRICING SECTION -->
<section class="py-24 px-6 bg-[var(--bg)]">
  <div class="max-w-7xl mx-auto">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="text-4xl font-black mb-4">Escolha o seu plano</h2>
      <p class="text-lg text-[var(--muted)]">Planos acessíveis e sem surpresas. Comece de graça e faça o upgrade quando precisar de mais potência.</p>
    </div>
    
    <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <!-- Free Plan -->
      <div class="panel p-8 flex flex-col hover:border-[var(--muted)] transition-colors">
        <h3 class="text-2xl font-black mb-2">Free</h3>
        <p class="text-[var(--muted)] text-sm h-10">Essencial para acompanhar uma moto sem custo.</p>
        <div class="my-6">
          <span class="text-5xl font-black">R$0</span>
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
        <a class="button-secondary w-full" href="/auth">Começar Grátis</a>
      </div>

      <!-- Pro Plan -->
      <div class="panel p-8 flex flex-col border-signal shadow-2xl relative overflow-hidden">
        <div class="absolute top-0 right-0 bg-signal text-ink font-bold text-xs uppercase tracking-wider px-3 py-1 rounded-bl-lg">
          Recomendado
        </div>
        <h3 class="text-2xl font-black mb-2 flex items-center gap-2">Pro <span class="flex h-3 w-3"><span class="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-signal opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-signal"></span></span></h3>
        <p class="text-[var(--muted)] text-sm h-10">Sem limites para quem usa a moto como ferramenta principal.</p>
        <div class="my-6">
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
        <a class="button-primary w-full bg-signal text-ink hover:bg-signal/80" href="/precos">Assinar Pro</a>
      </div>
    </div>
  </div>
</section>

<!-- CTA FOOTER -->
<section class="py-24 px-6 relative bg-ink text-white overflow-hidden">
  <div class="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-moss/20 to-transparent pointer-events-none"></div>
  <div class="max-w-4xl mx-auto text-center relative z-10">
    <FileText class="w-16 h-16 text-signal mx-auto mb-6 opacity-80" />
    <h2 class="text-5xl font-black mb-6">Pronto para acelerar?</h2>
    <p class="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
      Abandone as planilhas e o caderno. O Moto Track é o hub definitivo para a saúde, custos e histórico da sua companheira de estrada.
    </p>
    <a class="inline-flex items-center gap-3 bg-white text-ink px-8 py-4 rounded-md font-bold text-lg hover:-translate-y-1 hover:shadow-2xl hover:shadow-white/20 transition-all duration-300" href="/auth">
      Criar Conta Agora
      <ArrowRight class="w-5 h-5" />
    </a>
  </div>
</section>

<!-- FOOTER -->
<footer class="py-8 px-6 bg-[var(--bg)] border-t border-[var(--line)] text-center text-sm text-[var(--muted)]">
  <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
    <div class="flex items-center gap-2">
      <img src="/brand/svg/moto-track-logo-horizontal-dark.svg" alt="Moto Track" class="h-5 opacity-50 dark:hidden" />
      <img src="/brand/svg/moto-track-logo-horizontal-light.svg" alt="Moto Track" class="h-5 opacity-50 hidden dark:block" />
      <span class="ml-2 border-l border-[var(--line)] pl-2">&copy; {new Date().getFullYear()}</span>
    </div>
    <div class="flex items-center gap-4">
      <a href="/termos" class="hover:text-ink dark:hover:text-white transition">Termos</a>
      <a href="/politica" class="hover:text-ink dark:hover:text-white transition">Privacidade</a>
    </div>
  </div>
</footer>
