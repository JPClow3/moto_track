<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { onMount } from "svelte";
  import { ChevronDown, Check, Bell, ShieldCheck } from "lucide-svelte";
  import {
    disablePushNotifications,
    enablePushNotifications,
    pushNotificationsEnabled,
  } from "$lib/utils/push";
  import { t, format } from "$lib/i18n/store";
  import type { MessageKey } from "$lib/i18n";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import PageHeader from "$lib/components/app/PageHeader.svelte";

  type ApiToken = {
    id: string;
    name: string;
    key_prefix: string;
    is_active: boolean;
  };
  export let data: {
    profile: Record<string, string | boolean | Date | null> | null;
    hasProAccess: boolean;
    theme: string;
    requests: Array<Record<string, string | Date>>;
    checkout: string | null;
    billingSummary?: {
      trialEndsAt: string | null;
      nextBillingAt: string | null;
    } | null;
    initialTokens?: ApiToken[];
    tokenLoadError?: boolean;
  };
  export let form: { ok?: boolean; message?: string } | null;

  $: isPro = data.hasProAccess;
  $: hasBillingCustomer = Boolean(data.profile?.billing_customer_id);
  $: isCancelling = data.profile?.cancel_at_period_end === true;
  $: isPastDue = ["past_due", "on_hold"].includes(
    String(data.profile?.billing_subscription_status),
  );
  $: trialEndsAt = data.billingSummary?.trialEndsAt ?? null;
  $: nextBillingAt =
    data.billingSummary?.nextBillingAt ?? data.profile?.current_period_end;
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  };
  function dateValue(value: unknown): string | null {
    if (!(value instanceof Date) && typeof value !== "string") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  let pushMessage = "";
  let pushBusy = false;
  let pushEnabled: boolean | null = null;
  let pushStatusRole: "status" | "alert" = "status";
  let deletionConfirmation = "";
  let pendingAction = "";
  let themeValue = data.theme;
  let savedTheme = data.theme;
  let themeBusy = false;
  let themeMessage = "";
  let themeFailed = false;
  let tokenMessage = "";
  let tokenBusy = false;
  let tokenLoading = false;
  let tokenLoadFailed = data.tokenLoadError ?? false;
  let tokenStatusRole: "status" | "alert" = "status";
  let tokenConfirmDialog: ConfirmDialog;
  let tokens: ApiToken[] = data.initialTokens ?? [];

  async function bounded<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error($t("conta.requestTimeout"))),
            10000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function apiFetch(path: string, options?: Parameters<typeof fetch>[1]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      return await fetch(path, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  async function loadTokens() {
    tokenLoading = true;
    tokenLoadFailed = false;
    try {
      const response = await apiFetch("/api/v1/tokens");
      if (!response.ok) throw new Error();
      const body = await bounded(response.json());
      tokens = body.results ?? [];
    } catch {
      tokenLoadFailed = true;
    } finally {
      tokenLoading = false;
    }
  }
  async function createApiToken() {
    tokenBusy = true;
    tokenMessage = "";
    try {
      const response = await apiFetch("/api/v1/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: $t("conta.title") }),
      });
      const body = await bounded(response.json());
      if (!response.ok || typeof body.token !== "string") throw new Error();
      tokenStatusRole = "status";
      tokenMessage = $t("conta.tokenCreated", { token: body.token });
      await loadTokens();
    } catch {
      tokenMessage = $t("conta.tokenCreateFailed");
      tokenStatusRole = "alert";
    } finally {
      tokenBusy = false;
    }
  }
  async function revokeApiToken(id: string) {
    if (!(await tokenConfirmDialog.ask($t("conta.tokenRevokeConfirm")))) return;
    tokenBusy = true;
    tokenMessage = "";
    try {
      const response = await apiFetch(
        `/api/v1/tokens?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      tokenStatusRole = "status";
      tokenMessage = $t("conta.tokenRevoked");
      await loadTokens();
    } catch {
      tokenStatusRole = "alert";
      tokenMessage = $t("conta.tokenRevokeFailed");
    } finally {
      tokenBusy = false;
    }
  }

  onMount(() => {
    void loadPushState();
  });
  async function loadPushState() {
    try {
      pushEnabled = await bounded(pushNotificationsEnabled());
    } catch {
      pushEnabled = false;
    }
  }
  async function togglePush() {
    const wasEnabled = pushEnabled;
    pushBusy = true;
    pushMessage = "";
    try {
      await bounded(
        wasEnabled ? disablePushNotifications() : enablePushNotifications(),
      );
      pushEnabled = !wasEnabled;
      pushStatusRole = "status";
      pushMessage = $t(
        pushEnabled ? "conta.pushEnabled" : "conta.pushDisabled",
      );
    } catch (error) {
      pushStatusRole = "alert";
      pushMessage =
        error instanceof Error ? error.message : $t("conta.pushFailed");
      await loadPushState();
    } finally {
      pushBusy = false;
    }
  }
  async function saveTheme(theme: string) {
    themeBusy = true;
    themeMessage = "";
    themeFailed = false;
    try {
      const response = await apiFetch("/api/theme", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (!response.ok) throw new Error();
      const resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document
        .querySelector("meta[name='theme-color']")
        ?.setAttribute("content", resolved === "dark" ? "#09090b" : "#fafafa");
      try {
        window.localStorage.setItem("moto-track-theme", theme);
      } catch {
        /* Storage is optional. */
      }
      savedTheme = theme;
      themeMessage = $t("conta.themeSaved");
    } catch {
      themeFailed = true;
      themeMessage = $t("conta.themeSaveFailed");
      themeValue = savedTheme;
    } finally {
      themeBusy = false;
    }
  }
  function enhanceAction(action: string): SubmitFunction {
    return () => {
      pendingAction = action;
      return async ({ update }) => {
        try {
          await update();
        } finally {
          pendingAction = "";
        }
      };
    };
  }
  function requestLabel(value: string | Date, kind: "type" | "status") {
    const labels: Record<string, MessageKey> =
      kind === "type"
        ? { export: "conta.exportRequest", deletion: "conta.deletionRequest" }
        : {
            open: "conta.requestOpen",
            pending: "conta.requestOpen",
            processing: "conta.requestProcessing",
            completed: "conta.requestCompleted",
            fulfilled: "conta.requestCompleted",
            rejected: "conta.requestRejected",
            cancelled: "conta.requestCancelled",
          };
    return labels[String(value)] ? $t(labels[String(value)]) : String(value);
  }
</script>

<svelte:head><title>{$t("conta.title")} · Moto Track</title></svelte:head>
<section class="mx-auto grid w-full max-w-4xl gap-6">
  <PageHeader
    eyebrow={$t("conta.eyebrow")}
    title={$t("conta.heading")}
    description={$t("conta.description")}
  />
  {#if form?.message}<p
      class="rounded border border-[var(--line)] bg-[var(--panel)] p-4 text-sm"
      class:text-danger={!form.ok}
      role={form.ok ? "status" : "alert"}
    >
      {form.message}
    </p>{/if}
  {#if data.checkout === "returned" && !isPro}<p
      class="rounded border border-[var(--line)] bg-[var(--panel)] p-4 text-sm"
      role="status"
    >
      {$t("conta.checkoutPending")}
    </p>
  {:else if data.checkout === "cancelled"}<p
      class="rounded border border-[var(--line)] p-4 text-sm"
      role="status"
    >
      {$t("conta.checkoutCancelled")}
    </p>{/if}

  <section class="panel overflow-hidden" aria-labelledby="subscription-heading">
    <div class="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
      <div class="min-w-0">
        <h2
          id="subscription-heading"
          class="text-sm font-medium text-[var(--muted)]"
        >
          {$t("conta.currentPlan")}
        </h2>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <p class="display text-4xl">
            {isPro ? "Moto Track Pro" : "Moto Track Free"}
          </p>
          <span
            class="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1 text-xs font-semibold"
            ><Check size={13} aria-hidden="true" />{trialEndsAt
              ? $t("conta.trialBadge")
              : isCancelling
                ? $t("conta.cancellingBadge")
                : isPastDue
                  ? $t("conta.paymentPending")
                  : $t("conta.activeBadge")}</span
          >
        </div>
        <p class="mt-3 max-w-xl text-sm leading-relaxed">
          {isPro
            ? trialEndsAt
              ? $t("conta.trialActive")
              : $t("conta.proDescription")
            : $t("conta.freeDescription")}
        </p>
      </div>
      <div class="grid gap-2 md:justify-items-end">
        {#if isPro}<a class="button-primary min-h-11" href="/billing/portal"
            >{$t("conta.manageSubscription")}</a
          >
          <p class="text-xs text-[var(--muted)]">{$t("conta.portalHint")}</p>
        {:else}<a class="button-primary min-h-11" href="/precos"
            >{$t("conta.upgrade")}</a
          >{#if hasBillingCustomer}<a
              class="button-secondary min-h-11"
              href="/billing/portal">{$t("conta.updatePayment")}</a
            >{/if}{/if}
      </div>
    </div>
    {#if isPro}
      <dl
        class="grid gap-4 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] px-5 py-4 sm:grid-cols-2 sm:px-6"
      >
        <div>
          <dt class="text-xs text-[var(--muted)]">
            {$t("conta.billingPeriod")}
          </dt>
          <dd class="mt-1 text-sm font-semibold">
            {data.profile?.billing_interval === "yearly"
              ? $t("pricing.yearly")
              : $t("pricing.monthly")}
          </dd>
        </div>
        {#if dateValue(nextBillingAt)}<div>
            <dt class="text-xs text-[var(--muted)]">
              {isCancelling
                ? $t("conta.accessUntil")
                : trialEndsAt
                  ? $t("conta.firstBilling")
                  : $t("conta.nextBilling")}
            </dt>
            <dd class="mt-1 text-sm font-semibold">
              <time
                data-testid="next-billing-date"
                datetime={dateValue(nextBillingAt) ?? undefined}
                >{$format.date(dateValue(nextBillingAt)!, dateOptions)}</time
              >
            </dd>
          </div>{/if}
      </dl>
    {/if}
    {#if isCancelling || isPastDue}<p
        class="border-t border-[var(--line)] px-5 py-4 text-sm sm:px-6"
        role="status"
      >
        {isCancelling
          ? $t("conta.cancelPending")
          : $t(
              "conta.pastDue",
            )}{#if isPastDue && dateValue(data.profile?.grace_until)}
          {$t("conta.graceUntil", {
            date: $format.date(
              dateValue(data.profile?.grace_until)!,
              dateOptions,
            ),
          })}{/if}
      </p>{/if}
  </section>

  <div class="grid gap-6 md:grid-cols-2">
    <section class="panel p-5 sm:p-6" aria-labelledby="preferences-heading">
      <h2 id="preferences-heading" class="font-semibold">
        {$t("conta.preferences")}
      </h2>
      <p class="mt-1 text-sm text-[var(--muted)]">
        {$t("conta.preferencesHint")}
      </p>
      <div class="mt-5">
        <label for="account-theme" class="text-sm font-medium"
          >{$t("conta.theme")}</label
        >
        <select
          id="account-theme"
          class="field mt-2 w-full"
          bind:value={themeValue}
          disabled={themeBusy}
          on:change={() => saveTheme(themeValue)}
          ><option value="system">{$t("conta.themeSystem")}</option><option
            value="light">{$t("conta.themeLight")}</option
          ><option value="dark">{$t("conta.themeDark")}</option></select
        >
        {#if themeBusy || themeMessage}<p
            class="mt-2 text-xs"
            class:text-danger={themeFailed}
            role={themeFailed ? "alert" : "status"}
          >
            {themeBusy ? $t("conta.saving") : themeMessage}
          </p>{/if}
      </div>
      <div class="mt-5 border-t border-[var(--line)] pt-4">
        <p class="flex items-center gap-2 text-sm font-medium">
          <Bell size={16} aria-hidden="true" />{$t("conta.notifications")}
        </p>
        <p class="mt-1 text-sm text-[var(--muted)]">
          {$t("conta.notificationsHint")}
        </p>
        <button
          class="button-secondary mt-3 min-h-11"
          type="button"
          disabled={pushBusy || pushEnabled === null}
          on:click={togglePush}
          >{pushBusy
            ? $t("conta.saving")
            : pushEnabled === null
              ? $t("conta.checkingNotifications")
              : pushEnabled
                ? $t("conta.disablePush")
                : $t("conta.enablePush")}</button
        >
        {#if pushMessage}<p
            class="mt-3 text-sm"
            class:text-danger={pushStatusRole === "alert"}
            role={pushStatusRole}
          >
            {pushMessage}
          </p>{/if}
      </div>
    </section>

    <section class="panel p-5 sm:p-6" aria-labelledby="personal-data-heading">
      <h2
        id="personal-data-heading"
        class="flex items-center gap-2 font-semibold"
      >
        <ShieldCheck size={17} aria-hidden="true" />{$t("conta.personalData")}
      </h2>
      <p class="mt-1 text-sm leading-relaxed text-[var(--muted)]">
        {$t("conta.personalDataHint")}
      </p>
      <div class="mt-5 grid gap-3">
        <a class="button-secondary min-h-11" href="/billing/conta/export"
          >{$t("conta.downloadExport")}</a
        >
        <form
          method="POST"
          action="?/requestExport"
          use:enhance={enhanceAction("export")}
        >
          <button
            class="button-secondary min-h-11 w-full"
            disabled={pendingAction !== ""}
            >{pendingAction === "export"
              ? $t("conta.sending")
              : $t("conta.requestExport")}</button
          >
        </form>
      </div>
      <div class="mt-5 border-t border-[var(--line)] pt-4">
        <h3 class="text-xs font-semibold">{$t("conta.requests")}</h3>
        <ul class="mt-2 grid gap-3 text-sm">
          {#each data.requests as request}<li
              class="flex flex-wrap justify-between gap-1"
            >
              <div>
                <p>{requestLabel(request.request_type, "type")}</p>
                {#if dateValue(request.created_at)}<time
                    class="text-xs text-[var(--muted)]"
                    datetime={dateValue(request.created_at) ?? undefined}
                    >{$format.date(
                      dateValue(request.created_at)!,
                      dateOptions,
                    )}</time
                  >{/if}
              </div>
              <span class="text-xs text-[var(--muted)]"
                >{requestLabel(request.status, "status")}</span
              >
            </li>
          {:else}<li class="text-sm text-[var(--muted)]">
              {$t("conta.noRequests")}
            </li>{/each}
        </ul>
      </div>
    </section>
  </div>

  <details class="panel account-disclosure">
    <summary
      class="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-5 sm:px-6"
      ><span
        ><span class="block text-sm font-semibold">{$t("conta.apiTokens")}</span
        ><span class="mt-1 block text-xs text-[var(--muted)]"
          >{$t("conta.apiTokensSummary")}</span
        ></span
      ><ChevronDown
        class="disclosure-chevron shrink-0 text-[var(--muted)]"
        size={18}
        aria-hidden="true"
      /></summary
    >
    <div class="border-t border-[var(--line)] p-5 sm:p-6">
      <p class="max-w-2xl text-sm text-[var(--muted)]">
        {$t("conta.apiTokensHint")}
      </p>
      <ConfirmDialog
        bind:this={tokenConfirmDialog}
        confirmLabel={$t("conta.revokeToken")}
      />
      <button
        class="button-secondary mt-4 min-h-11"
        type="button"
        on:click={createApiToken}
        disabled={tokenBusy || tokenLoading}
        >{tokenBusy ? $t("conta.saving") : $t("conta.createToken")}</button
      >
      {#if tokenMessage}<p
          class="mt-3 break-all rounded border border-[var(--line)] p-3 text-sm"
          class:text-danger={tokenStatusRole === "alert"}
          role={tokenStatusRole}
        >
          {tokenMessage}
        </p>{/if}
      {#if tokenLoadFailed}<div class="mt-4 flex flex-wrap items-center gap-3">
          <p class="text-sm text-danger" role="alert">
            {$t("conta.tokensLoadFailed")}
          </p>
          <button
            class="button-secondary min-h-11"
            type="button"
            on:click={loadTokens}
            disabled={tokenLoading}>{$t("common.retry")}</button
          >
        </div>{/if}
      <div class="mt-4 grid gap-3 text-sm">
        {#if tokenLoading}<p class="text-[var(--muted)]" role="status">
            {$t("conta.tokensLoading")}
          </p>
        {:else if tokens.length}{#each tokens as token}<div
              class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"
            >
              <div class="min-w-0">
                <p class="break-words font-medium">{token.name}</p>
                <p class="mt-1 text-xs text-[var(--muted)]">
                  <code>{token.key_prefix}…</code> · {token.is_active
                    ? $t("conta.tokenActive")
                    : $t("conta.tokenInactive")}
                </p>
              </div>
              {#if token.is_active}<button
                  class="button-secondary min-h-11"
                  type="button"
                  on:click={() => revokeApiToken(token.id)}
                  disabled={tokenBusy}>{$t("conta.revokeToken")}</button
                >{/if}
            </div>{/each}
        {:else if !tokenLoadFailed}<p class="text-[var(--muted)]">
            {$t("conta.noTokens")}
          </p>{/if}
      </div>
    </div>
  </details>

  <details class="panel account-disclosure">
    <summary
      class="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-5 sm:px-6"
      ><span
        ><span class="block text-sm font-semibold"
          >{$t("conta.deleteAccount")}</span
        ><span class="mt-1 block text-xs text-[var(--muted)]"
          >{$t("conta.deleteSummary")}</span
        ></span
      ><ChevronDown
        class="disclosure-chevron shrink-0 text-[var(--muted)]"
        size={18}
        aria-hidden="true"
      /></summary
    >
    <div class="border-t border-[var(--line)] p-5 sm:p-6">
      <p class="max-w-xl text-sm leading-relaxed">{$t("conta.deletionHint")}</p>
      <form
        class="mt-4 grid max-w-md gap-3"
        method="POST"
        action="?/requestDeletion"
        use:enhance={enhanceAction("deletion")}
      >
        <label class="text-sm font-medium"
          >{$t("conta.deleteConfirmLabel")}<input
            class="field mt-2 w-full"
            name="confirmation"
            bind:value={deletionConfirmation}
            placeholder="EXCLUIR"
            autocomplete="off"
            required
          /></label
        ><button
          class="button-danger min-h-11 justify-self-start"
          type="submit"
          disabled={deletionConfirmation !== "EXCLUIR" || pendingAction !== ""}
          >{pendingAction === "deletion"
            ? $t("conta.sending")
            : $t("conta.requestDeletion")}</button
        >
      </form>
    </div>
  </details>
</section>

<style>
  summary::-webkit-details-marker {
    display: none;
  }
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 4px;
  }
  .account-disclosure[open] :global(.disclosure-chevron) {
    transform: rotate(180deg);
  }
</style>
