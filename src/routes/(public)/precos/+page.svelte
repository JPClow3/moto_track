<script lang="ts">
  import type { ProPricing } from "$types/billing";

  export let data: { pricing: ProPricing };

  // Segments rather than {@html}, matching the landing page.
  type Segment = { t: string; b?: boolean };

  const freePlan: Segment[][] = [
    [{ t: "Gestão de " }, { t: "1 moto ativa", b: true }],
    [{ t: "Até 3 uploads de recibos e fotos" }],
    [{ t: "3 lembretes ativos simultâneos" }],
    [{ t: "3 turnos profissionais por mês" }],
  ];

  const proPlan: Segment[][] = [
    [{ t: "Motos ilimitadas", b: true }, { t: " na garagem" }],
    [{ t: "Uploads e anexos ilimitados", b: true }],
    [{ t: "Lembretes ilimitados", b: true }],
    [{ t: "Turnos ilimitados", b: true }, { t: " para profissionais" }],
    [{ t: "Relatório de venda com selo Pro" }],
  ];

  $: annualSavings =
    data.pricing.monthly && data.pricing.yearly
      ? data.pricing.monthly.amountCents * 12 - data.pricing.yearly.amountCents
      : 0;
  $: formattedAnnualSavings = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(annualSavings / 100);
</script>

<svelte:head><title>Preços · Moto Track</title></svelte:head>

<div class="relative overflow-hidden px-6 py-24">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow page-glow" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-4xl">
    <div class="mx-auto max-w-2xl text-center">
      <p class="eyebrow justify-center">
        <span class="slash-rule" aria-hidden="true"></span>
        Moto Track Pro
      </p>
      <h1 class="display mt-5 text-5xl sm:text-6xl">Escolha o seu plano</h1>
      <p class="mt-5 text-lg text-[var(--muted)]">
        Sem cartão, sem pegadinha. Comece de graça e suba de plano só quando
        precisar de mais.
      </p>
    </div>

    <div class="mt-16 grid gap-6 md:grid-cols-2">
      <!-- Free -->
      <div class="panel flex flex-col p-8">
        <h2 class="display text-3xl">Free</h2>
        <p class="mt-2 text-sm text-[var(--muted)]">
          O essencial para acompanhar uma moto.
        </p>
        <div class="my-8">
          <p class="display numeric text-6xl">R$0</p>
          <p class="mt-2 text-xs text-[var(--muted)]">Para sempre</p>
        </div>
        <ul class="mb-8 flex-1 space-y-3.5">
          {#each freePlan as item, i (i)}
            <li class="flex items-start gap-3 text-sm text-[var(--muted)]">
              <span class="tick" aria-hidden="true"></span>
              <span>
                {#each item as seg, j (j)}
                  {#if seg.b}<strong class="text-[var(--fg)]">{seg.t}</strong
                    >{:else}{seg.t}{/if}
                {/each}
              </span>
            </li>
          {/each}
        </ul>
        <a class="button-secondary w-full" href="/auth">Começar grátis</a>
      </div>

      <!-- Pro — inverted surface, matching the landing page. -->
      <div
        class="relative flex flex-col overflow-hidden rounded-panel bg-[var(--panel-invert)] p-8 text-paper shadow-lift"
      >
        <div class="corner-slashes" aria-hidden="true"></div>
        <div class="flex items-center justify-between">
          <h2 class="display text-3xl">Pro</h2>
          <span
            class="label-tech rounded-sm bg-[var(--accent-solid)] px-2.5 py-1 text-white"
          >
            Recomendado
          </span>
        </div>
        <p class="mt-2 text-sm text-paper/60">
          Sem limites para quem usa a moto como ferramenta.
        </p>

        <form method="GET" action="/billing/checkout">
          <fieldset
            class="mt-8 grid grid-cols-2 gap-2"
            aria-label="Período de cobrança"
          >
            <label class="billing-choice">
              <input type="radio" name="interval" value="monthly" checked />
              <span>Mensal</span>
              <small
                >{data.pricing.monthly?.formatted ?? "Preço no checkout"}</small
              >
            </label>
            <label class="billing-choice">
              <input type="radio" name="interval" value="yearly" />
              <span>Anual</span>
              <small
                >{data.pricing.yearly?.formatted ?? "Preço no checkout"}</small
              >
            </label>
          </fieldset>

          <!-- Live from Stripe, so this can't drift from what checkout charges. -->
          <div class="my-8">
            {#if data.pricing.monthly}
              <p class="display numeric text-6xl text-[var(--accent)]">
                {data.pricing.monthly.formatted}
              </p>
              <p class="mt-2 text-xs text-paper/50">
                por mês
                {#if annualSavings > 0}
                  &middot; anual economiza {formattedAnnualSavings}
                {/if}
              </p>
            {:else}
              <p class="display numeric text-6xl text-[var(--accent)]">
                R$&nbsp;—
              </p>
              <p class="mt-2 text-xs text-paper/50">
                Preço confirmado no checkout
              </p>
            {/if}
          </div>

          <ul class="mb-8 flex-1 space-y-3.5">
            {#each proPlan as item, i (i)}
              <li class="flex items-start gap-3 text-sm text-paper/80">
                <span class="tick tick--accent" aria-hidden="true"></span>
                <span>
                  {#each item as seg, j (j)}
                    {#if seg.b}<strong class="text-paper">{seg.t}</strong
                      >{:else}{seg.t}{/if}
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
          <button class="button-accent w-full">Continuar para checkout</button>
        </form>
      </div>
    </div>
  </div>
</div>

<style>
  .page-glow {
    top: -20%;
    right: -10%;
    width: 55%;
    height: 80%;
  }

  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    pointer-events: none;
    opacity: 0.18;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }

  .billing-choice {
    display: grid;
    gap: 0.15rem;
    cursor: pointer;
    border: 1px solid color-mix(in srgb, white 20%, transparent);
    border-radius: 0.35rem;
    padding: 0.7rem;
    color: rgb(255 255 255 / 0.8);
  }

  .billing-choice input {
    position: absolute;
    opacity: 0;
  }

  .billing-choice:has(input:checked) {
    border-color: var(--accent);
    background: rgb(255 255 255 / 0.08);
    color: white;
  }

  .billing-choice small {
    color: rgb(255 255 255 / 0.55);
  }
</style>
