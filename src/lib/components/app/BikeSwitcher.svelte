<script lang="ts">
  import { page } from "$app/stores";
  import Check from "lucide-svelte/icons/check";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import Plus from "lucide-svelte/icons/plus";
  import Warehouse from "lucide-svelte/icons/warehouse";
  import { Motorcycle } from "$components/icons";
  import { t } from "$lib/i18n/store";

  type SwitcherBike = {
    id: string;
    name: string;
    brand?: string | null;
    model?: string | null;
  };

  // Disclosure, not an ARIA menu: the list holds real form buttons and a
  // link, which keeps the default Tab order and works without JS. Picking a
  // bike submits `?bike=<id>` to the current page; the (app) layout load
  // validates ownership, stores the choice and drops the param.
  let {
    motorcycles = [],
    activeId = null,
  }: { motorcycles?: SwitcherBike[]; activeId?: string | null } = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();

  const active = $derived(
    motorcycles.find((moto) => String(moto.id) === activeId) ??
      motorcycles[0] ??
      null,
  );
  const listId = "bike-switcher-list";

  function close(restoreFocus = false) {
    open = false;
    if (restoreFocus) trigger?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }

  function onDocumentClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) close();
  }

  function onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (open && next && root && !root.contains(next)) close();
  }

  const subtitle = (moto: SwitcherBike) =>
    [moto.brand, moto.model].filter(Boolean).join(" ");
</script>

<svelte:window onkeydown={onKeydown} onclick={onDocumentClick} />

{#if !active}
  <a
    href="/garage"
    class="focus-ring inline-flex min-h-11 items-center gap-2 rounded px-2 text-sm font-semibold text-[var(--fg)] hover:bg-[var(--accent-wash)]"
  >
    <Plus size={20} aria-hidden="true" />
    {$t("shell.addBike")}
  </a>
{:else}
  <div class="relative min-w-0" bind:this={root} onfocusout={onFocusOut}>
    <button
      bind:this={trigger}
      type="button"
      class="focus-ring flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded px-2 text-left transition hover:bg-[var(--accent-wash)]"
      aria-expanded={open}
      aria-controls={listId}
      aria-label={$t("shell.currentBike", { name: active.name })}
      onclick={() => (open = !open)}
    >
      <span
        class="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--panel-sunken)] text-[var(--muted)]"
        aria-hidden="true"
      >
        <Motorcycle size={20} />
      </span>
      <span class="min-w-0 truncate text-sm font-semibold text-[var(--fg)]"
        >{active.name}</span
      >
      <ChevronsUpDown
        size={16}
        class="shrink-0 text-[var(--muted)]"
        aria-hidden="true"
      />
    </button>

    {#if open}
      <div
        id={listId}
        class="absolute left-0 top-full z-40 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-lift"
      >
        <p class="label-tech px-2.5 pb-1 pt-1.5 text-[var(--muted)]">
          {$t("shell.yourBikes")}
        </p>
        <form method="GET" action={$page.url.pathname} onsubmit={() => close()}>
          <ul>
            {#each motorcycles as moto (moto.id)}
              {@const current = String(moto.id) === String(active.id)}
              <li>
                <button
                  type="submit"
                  name="bike"
                  value={moto.id}
                  class="focus-ring flex min-h-11 w-full items-center gap-3 rounded px-2.5 py-2 text-left hover:bg-[var(--accent-wash)]"
                  aria-current={current ? "true" : undefined}
                >
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-sm text-[var(--fg)]"
                      class:font-semibold={current}>{moto.name}</span
                    >
                    {#if subtitle(moto)}
                      <span class="block truncate text-xs text-[var(--muted)]"
                        >{subtitle(moto)}</span
                      >
                    {/if}
                  </span>
                  {#if current}
                    <Check
                      size={16}
                      class="shrink-0 text-[var(--fg)]"
                      aria-hidden="true"
                    />
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        </form>
        <div class="mt-1 border-t border-[var(--line)] pt-1">
          <a
            href="/garage"
            class="focus-ring flex min-h-11 items-center gap-3 rounded px-2.5 text-sm font-medium text-[var(--fg)] hover:bg-[var(--accent-wash)]"
            onclick={() => close()}
          >
            <Warehouse
              size={16}
              class="text-[var(--muted)]"
              aria-hidden="true"
            />
            {$t("shell.manageGarage")}
          </a>
        </div>
      </div>
    {/if}
  </div>
{/if}
