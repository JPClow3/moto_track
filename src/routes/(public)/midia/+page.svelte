<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { publicCopy } from "$lib/i18n/public-copy";
  import LaunchMotion from "$components/LaunchMotion.svelte";

  const c = (source: string) => publicCopy($locale, source);
  const kinds = ["cost", "service", "reminder"] as const;
  let replay = $state(0);
</script>

<svelte:head
  ><title>{c("Moto Track em movimento")}</title><meta
    name="description"
    content={c(
      "Explore custos, histórico de manutenção e lembretes em movimento.",
    )}
  /><link rel="canonical" href="https://moto-track.net/midia" /></svelte:head
>
<div class="mx-auto max-w-6xl px-4 py-14 sm:px-6">
  <p class="eyebrow">
    <span class="slash-rule" aria-hidden="true"></span>{c(
      "Cada quilômetro conta",
    )}
  </p>
  <h1 class="display mt-5 text-5xl sm:text-7xl">
    {c("Menos achismo. Mais estrada.")}
  </h1>
  <p class="mt-6 max-w-2xl text-lg text-[var(--muted)]">
    {c(
      "Três formas de acompanhar a história da sua moto. Os valores são ilustrativos.",
    )}
  </p>
  <button
    type="button"
    class="button-secondary mt-6"
    onclick={() => (replay += 1)}>{c("Rever animações")}</button
  >
  {#key replay}<div class="mt-8 grid gap-5 lg:grid-cols-3">
      {#each kinds as kind (kind)}<LaunchMotion {kind} />{/each}
    </div>{/key}
  <div class="mt-10 grid gap-5 sm:grid-cols-2">
    <img
      src="/images/launch/workshop-care.webp"
      width="1536"
      height="1024"
      alt={c("Inspeção de freios na oficina")}
      class="w-full rounded"
      loading="lazy"
    /><img
      src="/images/launch/fuel-stop.webp"
      width="1536"
      height="1024"
      alt={c("Motociclista conferindo um recibo ao lado da moto estacionada")}
      class="w-full rounded"
      loading="lazy"
    />
  </div>
  <a href="/demo" class="button-accent mt-8">{c("Conheça o app")}</a>
</div>
