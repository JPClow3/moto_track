<script lang="ts">
  import { locale } from "$lib/i18n/store";
  import { publicCopy } from "$lib/i18n/public-copy";
  import BrandLogo from "./ui/BrandLogo.svelte";
  // Lifted out of the landing page so /blog, /roadmap and /precos stop ending
  // in a hard cut at the last section.
</script>

<footer class="border-t border-[var(--line)] px-6 py-8">
  <div
    class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row"
  >
    <div class="flex items-center gap-3">
      <BrandLogo size={20} class="opacity-60" />
      <span
        class="border-l border-[var(--line)] pl-3 text-sm text-[var(--muted)]"
      >
        © {new Date().getFullYear()}
      </span>
    </div>
    <nav
      class="flex flex-wrap items-center justify-center gap-5 text-sm text-[var(--muted)]"
      aria-label={publicCopy($locale, "Navegação secundária")}
    >
      {#each [{ href: "/demo", title: "Demonstração" }, { href: "/instalar", title: "Instalar" }, { href: "/suporte", title: "Suporte" }, { href: "/midia", title: "Em movimento" }] as link (link.href)}
        <a
          href={link.href}
          class="focus-ring nav-link inline-flex min-h-11 items-center"
          >{publicCopy($locale, link.title)}</a
        >
      {/each}
      <a
        href="/blog"
        class="focus-ring nav-link inline-flex min-h-11 items-center">Blog</a
      >
      <a
        href="/roadmap"
        class="focus-ring nav-link inline-flex min-h-11 items-center">Roadmap</a
      >
      <a
        href="/termos"
        class="focus-ring nav-link inline-flex min-h-11 items-center"
        >{publicCopy($locale, "Termos")}</a
      >
      <a
        href="/privacidade"
        class="focus-ring nav-link inline-flex min-h-11 items-center"
        >{publicCopy($locale, "Privacidade")}</a
      >
      <a
        href="/lgpd"
        class="focus-ring nav-link inline-flex min-h-11 items-center">LGPD</a
      >
    </nav>
  </div>
</footer>
