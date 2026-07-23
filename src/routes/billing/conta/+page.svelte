<script lang="ts">
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import { enablePushNotifications } from "$lib/utils/push";
  import { t } from "$lib/i18n/store";

  export let data: {
    profile: Record<string, string | boolean | null> | null;
    hasProAccess: boolean;
    theme: string;
    requests: Array<Record<string, string>>;
    checkout: string | null;
  };
  export let form: { ok?: boolean; message?: string } | null;

  let pushMessage = "";
  let pushBusy = false;
  let deletionConfirmation = "";
  let tokenMessage = "";
  let tokenBusy = false;
  let tokens: Array<{
    id: string;
    name: string;
    key_prefix: string;
    is_active: boolean;
  }> = [];

  $: isPro = data.hasProAccess;
  $: hasStripeCustomer = Boolean(data.profile?.stripe_customer_id);
  $: isCancelling = data.profile?.cancel_at_period_end === true;
  $: isPastDue = data.profile?.stripe_subscription_status === "past_due";

  async function loadTokens() {
    const response = await fetch("/api/v1/tokens");
    if (!response.ok) return;
    const body = await response.json();
    tokens = body.results ?? [];
  }

  async function createApiToken() {
    tokenBusy = true;
    tokenMessage = "";
    try {
      const response = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Conta" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "token error");
      tokenMessage = $t("conta.tokenCreated", { token: body.token });
      await loadTokens();
    } catch (error) {
      tokenMessage =
        error instanceof Error ? error.message : $t("conta.pushFailed");
    } finally {
      tokenBusy = false;
    }
  }

  async function revokeApiToken(id: string) {
    await fetch(`/api/v1/tokens?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await loadTokens();
  }

  onMount(() => {
    void loadTokens();
  });

  async function enablePush() {
    pushBusy = true;
    pushMessage = "";
    try {
      await enablePushNotifications();
      pushMessage = $t("conta.pushEnabled");
    } catch (error) {
      pushMessage =
        error instanceof Error ? error.message : $t("conta.pushFailed");
    } finally {
      pushBusy = false;
    }
  }

  async function saveTheme(theme: string) {
    await fetch("/api/theme", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }
</script>

<svelte:head><title>{$t("conta.title")} · Moto Track</title></svelte:head>
<section class="grid gap-6">
  <div>
    <p class="eyebrow">
      <span class="slash-rule" aria-hidden="true"></span>{$t("conta.eyebrow")}
    </p>
    <h1 class="display text-4xl">{$t("conta.heading")}</h1>
  </div>

  {#if form?.message}
    <p
      class="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm"
      class:text-danger={!form.ok}
    >
      {form.message}
    </p>
  {/if}

  <div class="panel p-5">
    {#if data.checkout === "success" && !isPro}
      <p
        class="bg-[var(--accent)]/10 mb-4 rounded-md p-3 text-sm text-[var(--fg)]"
      >
        {$t("conta.checkoutPending")}
      </p>
    {:else if data.checkout === "cancelled"}
      <p
        class="mb-4 rounded-md bg-[var(--line)] p-3 text-sm text-[var(--muted)]"
      >
        {$t("conta.checkoutCancelled")}
      </p>
    {/if}
    <p class="text-sm text-[var(--muted)]">{$t("conta.currentPlan")}</p>
    <p class="display mt-2 text-4xl uppercase">
      {isPro ? "pro" : (data.profile?.plan ?? "free")}
    </p>
    {#if isPro}
      <p class="mt-2 text-sm text-[var(--muted)]">
        {$t("conta.billingInterval", {
          interval:
            data.profile?.billing_interval === "yearly"
              ? $t("pricing.yearly")
              : $t("pricing.monthly"),
        })}
        {#if isCancelling}
          {$t("conta.cancelPending")}{/if}
        {#if isPastDue && data.profile?.grace_until}
          {$t("conta.graceUntil", {
            date: String(data.profile.grace_until).slice(0, 10),
          })}{/if}
      </p>
    {:else if isPastDue}
      <p class="mt-2 text-sm text-[var(--muted)]">
        {$t("conta.pastDue")}
      </p>
    {/if}
    <div class="mt-4 flex flex-wrap gap-3">
      {#if isPro}
        <a class="button-primary" href="/billing/portal"
          >{$t("conta.manageSubscription")}</a
        >
      {:else}
        <a class="button-primary" href="/precos">{$t("conta.upgrade")}</a>
        {#if hasStripeCustomer}
          <a class="button-secondary" href="/billing/portal"
            >{$t("conta.updatePayment")}</a
          >
        {/if}
      {/if}
    </div>
  </div>

  <div class="panel p-5">
    <h2 class="font-semibold">{$t("conta.preferences")}</h2>
    <div class="mt-4 flex flex-wrap gap-3">
      <label class="text-sm text-[var(--muted)]">
        {$t("conta.theme")}
        <select
          class="field mt-1"
          value={data.theme}
          on:change={(event) =>
            saveTheme((event.currentTarget as HTMLSelectElement).value)}
        >
          <option value="system">{$t("conta.themeSystem")}</option>
          <option value="light">{$t("conta.themeLight")}</option>
          <option value="dark">{$t("conta.themeDark")}</option>
        </select>
      </label>
      <button
        class="button-secondary self-end"
        type="button"
        disabled={pushBusy}
        on:click={enablePush}
      >
        {$t("conta.enablePush")}
      </button>
    </div>
    {#if pushMessage}
      <p class="mt-3 text-sm text-[var(--muted)]">{pushMessage}</p>
    {/if}
  </div>

  <div class="panel p-5">
    <h2 class="font-semibold">{$t("conta.personalData")}</h2>
    <p class="mt-2 text-sm text-[var(--muted)]">
      {$t("conta.personalDataHint")}
    </p>
    <div class="mt-4 flex flex-wrap gap-3">
      <a class="button-secondary" href="/billing/conta/export"
        >{$t("conta.downloadExport")}</a
      >
      <form method="POST" action="?/requestExport" use:enhance>
        <button class="button-secondary">{$t("conta.requestExport")}</button>
      </form>
    </div>
    <form
      class="mt-6 grid max-w-md gap-3"
      method="POST"
      action="?/requestDeletion"
      use:enhance
    >
      <label class="text-sm text-[var(--muted)]">
        {$t("conta.deleteConfirmLabel")}
        <input
          class="field mt-1"
          name="confirmation"
          bind:value={deletionConfirmation}
          placeholder="EXCLUIR"
          autocomplete="off"
          required
        />
      </label>
      <button class="button-danger" type="submit"
        >{$t("conta.requestDeletion")}</button
      >
    </form>
  </div>

  <div class="panel p-5">
    <h2 class="font-semibold">{$t("conta.apiTokens")}</h2>
    <p class="mt-2 text-sm text-[var(--muted)]">{$t("conta.apiTokensHint")}</p>
    <div class="mt-4 flex flex-wrap gap-3">
      <button
        class="button-secondary"
        type="button"
        on:click={createApiToken}
        disabled={tokenBusy}
      >
        {$t("conta.createToken")}
      </button>
    </div>
    {#if tokenMessage}
      <p class="mt-3 break-all text-sm text-[var(--muted)]">{tokenMessage}</p>
    {/if}
    <div class="mt-3 grid gap-2 text-sm">
      {#each tokens as token}
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] py-2"
        >
          <span>
            {token.name} · {token.key_prefix}… · {token.is_active
              ? "active"
              : "revoked"}
          </span>
          {#if token.is_active}
            <button
              class="button-secondary px-3 py-1.5 text-xs"
              type="button"
              on:click={() => revokeApiToken(token.id)}
            >
              {$t("conta.revokeToken")}
            </button>
          {/if}
        </div>
      {:else}
        <p class="text-[var(--muted)]">{$t("conta.noRequests")}</p>
      {/each}
    </div>
  </div>

  <div class="panel p-5">
    <h2 class="font-semibold">{$t("conta.requests")}</h2>
    <div class="mt-3 grid gap-2 text-sm">
      {#each data.requests as request}
        <div class="border-t border-[var(--line)] py-2">
          {request.request_type} · {request.status} · {request.created_at}
        </div>
      {:else}
        <p class="text-[var(--muted)]">{$t("conta.noRequests")}</p>
      {/each}
    </div>
  </div>
</section>
