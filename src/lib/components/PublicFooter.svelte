<script lang="ts">
  // Lifted out of the landing page so /blog, /roadmap and /precos stop ending
  // in a hard cut at the last section.
</script>

<footer class="border-t border-[var(--line)] px-6 py-8">
  <div
    class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row"
  >
    <div class="flex items-center gap-3">
      <img
        src="/brand/svg/moto-track-logo-horizontal-light.svg"
        alt="Moto Track"
        class="h-5 opacity-40 dark:hidden"
      />
      <img
        src="/brand/svg/moto-track-logo-horizontal-dark.svg"
        alt="Moto Track"
        class="hidden h-5 opacity-40 dark:block"
      />
      <span
        class="border-l border-[var(--line)] pl-3 text-sm text-[var(--muted)]"
      >
        © {new Date().getFullYear()}
      </span>
    </div>
    <nav
      class="flex flex-wrap items-center justify-center gap-5 text-sm text-[var(--muted)]"
      aria-label="Navegação secundária"
    >
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
        class="focus-ring nav-link inline-flex min-h-11 items-center">Termos</a
      >
      <a
        href="/privacidade"
        class="focus-ring nav-link inline-flex min-h-11 items-center"
        >Privacidade</a
      >
      <a
        href="/lgpd"
        class="focus-ring nav-link inline-flex min-h-11 items-center">LGPD</a
      >
    </nav>
  </div>
</footer>
