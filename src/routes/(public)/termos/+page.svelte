<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { legalCopy, termsSections } from "$lib/i18n/legal";
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import FileText from "lucide-svelte/icons/file-text";
  import Mail from "lucide-svelte/icons/mail";
  import Printer from "lucide-svelte/icons/printer";
  import Scale from "lucide-svelte/icons/scale";

  let { data } = $props();
  const { supportEmail } = $derived(data.contact);

  const copy = $derived(legalCopy($locale));
  const sections = $derived(termsSections($locale, data.contact));
</script>

<svelte:head>
  <title>{copy.terms.title} · Moto Track</title>
  <link rel="canonical" href="https://moto-track.net/termos" />
  <meta name="description" content={copy.terms.description} />
</svelte:head>

<section class="relative overflow-hidden border-b border-[var(--line)]">
  <div class="grid-backdrop" aria-hidden="true"></div>
  <div class="accent-glow legal-glow" aria-hidden="true"></div>
  <div class="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>
      {copy.terms.eyebrow}
    </p>
    <div class="mt-5 flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 class="display text-5xl sm:text-6xl lg:text-7xl">
          {copy.terms.headline}<br /><span class="text-[var(--accent)]"
            >{copy.terms.accent}</span
          >
        </h1>
        <p class="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          {copy.terms.introduction}
        </p>
      </div>
      <button
        class="button-secondary gap-2"
        type="button"
        onclick={() => window.print()}
        ><Printer size={20} aria-hidden="true" /> {copy.print}</button
      >
    </div>
    <p
      class="label-tech mt-10 border-t border-[var(--line)] pt-5 text-[var(--muted)]"
    >
      {copy.updated}
    </p>
  </div>
</section>

<section
  class="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-20"
>
  <aside class="lg:sticky lg:top-24 lg:self-start">
    <p class="label-tech text-[var(--muted)]">{copy.contents}</p>
    <nav
      class="mt-4 border-l border-[var(--line)]"
      aria-label={copy.terms.navigation}
    >
      {#each sections as section, index (section.id)}
        <a
          class="focus-ring legal-nav-link inline-flex min-h-11 w-full items-center px-4 py-2 text-sm text-[var(--muted)]"
          href={`#${section.id}`}
          ><span class="label-tech numeric mr-2 text-[var(--muted)]"
            >0{index + 1}</span
          >{section.title}</a
        >
      {/each}
    </nav>
  </aside>

  <article class="max-w-3xl">
    <div
      class="mb-12 grid gap-4 border-b border-[var(--line)] pb-6 sm:grid-cols-2"
    >
      <div class="flex gap-3">
        <FileText
          size={20}
          class="mt-0.5 shrink-0 text-[var(--muted)]"
          aria-hidden="true"
        />
        <p class="text-sm leading-relaxed text-[var(--muted)]">
          {copy.terms.refund}
        </p>
      </div>
      <div class="flex gap-3">
        <Scale
          size={20}
          class="mt-0.5 shrink-0 text-[var(--muted)]"
          aria-hidden="true"
        />
        <p class="text-sm leading-relaxed text-[var(--muted)]">
          {copy.terms.cancel}
        </p>
      </div>
    </div>
    {#each sections as section, index (section.id)}
      <section
        id={section.id}
        class="scroll-mt-28 border-b border-[var(--line)] py-9 first:pt-0"
      >
        <p class="label-tech numeric text-[var(--muted)]">0{index + 1}</p>
        <h2 class="display mt-3 text-3xl sm:text-4xl">{section.title}</h2>
        {#each section.paragraphs as paragraph}<p
            class="mt-4 leading-relaxed text-[var(--muted)]"
          >
            {paragraph}
          </p>{/each}
      </section>
    {/each}
    <div
      class="relative mt-10 overflow-hidden rounded-panel bg-[var(--panel-invert)] p-7 text-paper"
    >
      <div class="corner-slashes" aria-hidden="true"></div>
      <div class="relative flex gap-4">
        <Mail
          size={20}
          class="mt-0.5 shrink-0 text-paper/70"
          aria-hidden="true"
        />
        <div>
          <h2 class="display text-2xl">{copy.terms.supportHeading}</h2>
          <p class="mt-2 text-sm leading-relaxed text-paper/70">
            {copy.terms.supportText(supportEmail)}
          </p>
          <a
            class="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 rounded px-1 text-sm font-semibold text-paper underline underline-offset-4"
            href={`mailto:${supportEmail}`}
            >{copy.email} <ArrowRight size={16} aria-hidden="true" /></a
          >
        </div>
      </div>
    </div>
  </article>
</section>

<style>
  .legal-glow {
    top: -75%;
    right: -10%;
    width: 55%;
    height: 150%;
  }
  .legal-nav-link {
    transition:
      color 0.2s,
      border-color 0.2s;
  }
  .legal-nav-link:hover {
    color: var(--fg);
    border-left: 2px solid var(--fg);
    padding-left: calc(1rem - 2px);
  }
  .corner-slashes {
    position: absolute;
    top: -10px;
    right: -30px;
    width: 160px;
    height: 90px;
    opacity: 0.18;
    background: repeating-linear-gradient(
      100deg,
      var(--accent) 0 6px,
      transparent 6px 16px
    );
  }
</style>
