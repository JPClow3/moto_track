<script lang="ts">
  import { page } from "$app/stores";
  import { locale } from "$lib/i18n/store";
  import { LOCALES, LOCALE_LABELS } from "$lib/i18n";
  import { Languages } from "lucide-svelte";

  // A form POST, so this still works with JS off. `use:enhance` is deliberately
  // not used: the server sets a cookie and the page must re-render server-side
  // in the new language, which a full navigation gives us for free.

  /**
   * Both shells render this twice — once in the desktop rail and once in the
   * mobile drawer — and the hidden one stays in the DOM. A fixed id would mean
   * two elements sharing it whenever the drawer is open, which silently breaks
   * the <label for> association. Callers pass a distinct id per instance.
   */
  export let id = 'locale-select';
</script>

<form method="POST" action="/locale" class="locale-switcher">
  <input type="hidden" name="redirectTo" value={$page.url.pathname + $page.url.search} />
  <Languages class="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[var(--muted)]" aria-hidden="true" />
  <label class="sr-only" for={id}>{LOCALE_LABELS[$locale]}</label>
  <select
    {id}
    name="locale"
    class="focus-ring appearance-none bg-transparent py-1.5 pl-7 pr-6 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--fg)]"
    value={$locale}
    on:change={(event) => event.currentTarget.form?.requestSubmit()}
  >
    {#each LOCALES as option (option)}
      <option value={option}>{LOCALE_LABELS[option]}</option>
    {/each}
  </select>
  <!-- The submit button is the no-JS path; onchange covers everyone else. -->
  <noscript>
    <button class="button-secondary px-2 py-1 text-xs" type="submit">OK</button>
  </noscript>
</form>

<style>
  /* .sr-only comes from app.css — it is shared with the skip link and the
     table captions rather than redefined per component. */
  .locale-switcher {
    position: relative;
    display: flex;
    align-items: center;
  }
</style>
