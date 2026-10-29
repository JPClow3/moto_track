<script lang="ts">
  import { page } from "$app/stores";
  import { locale } from "$lib/i18n/store";
  import { publicCopy } from "$lib/i18n/public-copy";
  import ProductPreview, {
    PREVIEW_VIEWS,
  } from "$components/ProductPreview.svelte";

  const c = (source: string) => publicCopy($locale, source);
  const requested = $derived($page.url.searchParams.get("view") ?? "overview");
  const view = $derived(
    (PREVIEW_VIEWS as string[]).includes(requested) ? requested : "overview",
  );
</script>

<svelte:head
  ><title>{c("Conheça o app")} — Moto Track</title><meta
    name="description"
    content={c(
      "Explore exemplos de custos, abastecimentos e lembretes da sua moto.",
    )}
  /><link rel="canonical" href="https://moto-track.net/demo" /></svelte:head
>
<div
  class="mx-auto grid max-w-6xl items-start gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[.75fr_1.25fr] lg:gap-16 lg:py-20"
>
  <div class="min-w-0 lg:sticky lg:top-32">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>{c(
        "Explore antes de criar conta",
      )}
    </p>
    <h1 class="display mt-5 text-5xl sm:text-7xl">
      {c("Sua moto. Tudo mais claro.")}
    </h1>
    <p class="mt-6 text-lg leading-relaxed text-[var(--muted)]">
      {c(
        "Alterne as telas para explorar exemplos de custos, consumo, histórico de manutenção e lembretes.",
      )}
    </p>
    <p class="mt-4 text-sm text-[var(--muted)]">
      {c(
        "Os dados são fictícios. Seu painel é construído a partir dos registros que você adicionar.",
      )}
    </p>
    <div class="mt-8 flex flex-wrap gap-3">
      <a href="/auth" class="button-accent">{c("Criar conta grátis")}</a><a
        href="/instalar"
        class="button-secondary">{c("Como instalar")}</a
      >
    </div>
  </div>
  <div class="min-w-0">
    {#key view}<ProductPreview initial={view} />{/key}
  </div>
</div>
