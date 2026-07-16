<script lang="ts">
  import type { ProPricing } from "$types/billing";
  import { t, locale } from "$lib/i18n/store";
  import { formatMoney } from "$lib/i18n";

  export let data: { pricing: ProPricing };

  // Segments rather than {@html}, matching the landing page.
  type Segment = { t: string; b?: boolean };

  $: freePlan = [
    [{ t: $t("pricing.freeFeature1Prefix") }, { t: $t("pricing.freeFeature1Bold"), b: true }],
    [{ t: $t("pricing.freeFeature2") }],
    [{ t: $t("pricing.freeFeature3") }],
    [{ t: $t("pricing.freeFeature4") }],
  ] satisfies Segment[][];

  $: proPlan = [
    [{ t: $t("pricing.proFeature1Bold"), b: true }, { t: $t("pricing.proFeature1Suffix") }],
    [{ t: $t("pricing.proFeature2Bold"), b: true }],
    [{ t: $t("pricing.proFeature3Bold"), b: true }],
    [{ t: $t("pricing.proFeature4Bold"), b: true }, { t: $t("pricing.proFeature4Suffix") }],
    [{ t: $t("pricing.proFeature5") }],
  ] satisfies Segment[][];

  $: annualSavings =
    data.pricing.monthly && data.pricing.yearly
      ? data.pricing.monthly.amountCents * 12 - data.pricing.yearly.amountCents
      : 0;
  // Stays in BRL in every locale — that is what Stripe actually charges. Only
  // the separators and symbol placement follow the reader's locale.
  $: formattedAnnualSavings = formatMoney($locale, annualSavings);
</script>

<svelte:head><title>{$t('pricing.title')} · Moto Track</title></svelte:head>

<div class="relative overflow-hidden px-6 py-24">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow page-glow" aria-hidden="true"></div>

  <div class="relative mx-auto max-w-4xl">
    <div class="mx-auto max-w-2xl text-center">
      <p class="eyebrow justify-center">
        <span class="slash-rule" aria-hidden="true"></span>
        {$t('pricing.eyebrow')}
      </p>
      <h1 class="display mt-5 text-5xl sm:text-6xl">{$t('pricing.title')}</h1>
      <p class="mt-5 text-lg text-[var(--muted)]">{$t('pricing.subtitle')}</p>
    </div>

    <div class="mt-16 grid gap-6 md:grid-cols-2">
      <!-- Free -->
      <div class="panel flex flex-col p-8">
        <h2 class="display text-3xl">{$t('pricing.freeName')}</h2>
        <p class="mt-2 text-sm text-[var(--muted)]">{$t('pricing.freeTagline')}</p>
        <div class="my-8">
          <p class="display numeric text-6xl">{formatMoney($locale, 0)}</p>
          <p class="mt-2 text-xs text-[var(--muted)]">{$t('pricing.freeForever')}</p>
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
        <a class="button-secondary w-full" href="/auth">{$t('pricing.freeCta')}</a>
      </div>

      <!-- Pro — inverted surface, matching the landing page. -->
      <div
        class="relative flex flex-col overflow-hidden rounded-panel bg-[var(--panel-invert)] p-8 text-paper shadow-lift"
      >
        <div class="corner-slashes" aria-hidden="true"></div>
        <div class="flex items-center justify-between">
          <h2 class="display text-3xl">{$t('pricing.proName')}</h2>
          <span
            class="label-tech rounded-sm bg-[var(--accent-solid)] px-2.5 py-1 text-white"
          >
            {$t('pricing.recommended')}
          </span>
        </div>
        <p class="mt-2 text-sm text-paper/60">{$t('pricing.proTagline')}</p>

        <form method="GET" action="/billing/checkout">
          <fieldset
            class="mt-8 grid grid-cols-2 gap-2"
            aria-label={$t('pricing.billingPeriod')}
          >
            <label class="billing-choice">
              <input type="radio" name="interval" value="monthly" checked />
              <span>{$t('pricing.monthly')}</span>
              <small>{data.pricing.monthly?.formatted ?? $t('pricing.priceAtCheckout')}</small>
            </label>
            <label class="billing-choice">
              <input type="radio" name="interval" value="yearly" />
              <span>{$t('pricing.yearly')}</span>
              <small>{data.pricing.yearly?.formatted ?? $t('pricing.priceAtCheckout')}</small>
            </label>
          </fieldset>

          <!-- Live from Stripe, so this can't drift from what checkout charges. -->
          <div class="my-8">
            {#if data.pricing.monthly}
              <p class="display numeric text-6xl text-[var(--accent)]">
                {data.pricing.monthly.formatted}
              </p>
              <p class="mt-2 text-xs text-paper/50">
                {$t('pricing.perMonth')}
                {#if annualSavings > 0}
                  &middot; {$t('pricing.annualSaves', { amount: formattedAnnualSavings })}
                {/if}
              </p>
            {:else}
              <p class="display numeric text-6xl text-[var(--accent)]">
                R$&nbsp;—
              </p>
              <p class="mt-2 text-xs text-paper/50">
                {$t('pricing.priceConfirmedAtCheckout')}
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
          <button class="button-accent w-full">{$t('pricing.proCta')}</button>
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
