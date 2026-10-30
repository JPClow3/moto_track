<script lang="ts">
  import { page } from "$app/stores";
  import { t } from "$lib/i18n/store";
  import BrandLogo from "$components/ui/BrandLogo.svelte";
  import SocialSignIn from "$components/ui/SocialSignIn.svelte";
  import type { SocialAuthProvider } from "$lib/domain/social-auth";
  import ShieldAlert from "lucide-svelte/icons/shield-alert";
  import KeyRound from "lucide-svelte/icons/key-round";
  import Mail from "lucide-svelte/icons/mail";
  import LogIn from "lucide-svelte/icons/log-in";
  import UserPlus from "lucide-svelte/icons/user-plus";

  let {
    data,
    form,
  }: {
    data: {
      redirectTo: string;
      socialProviders: SocialAuthProvider[];
      message?: string;
      errorMessage?: string;
    };
    form: { message?: string; email?: string } | undefined;
  } = $props();

  // `/auth?mode=signUp` (the public header's "Criar conta" CTA) opens on the
  // sign-up tab; anything else keeps the sign-in default.
  let mode = $state<"signIn" | "signUp">(
    $page.url.searchParams.get("mode") === "signUp" ? "signUp" : "signIn",
  );
  let showReset = $state(false);
</script>

<svelte:head><title>{$t("auth.signIn")} · Moto Track</title></svelte:head>

<div
  class="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
>
  <div class="grid-backdrop" aria-hidden="true"></div>

  <div class="relative w-full max-w-[440px]">
    <div class="mb-8 text-center">
      <a
        href="/"
        class="focus-ring mb-8 inline-flex min-h-11 items-center rounded transition hover:opacity-70"
      >
        <BrandLogo size={28} />
      </a>
      <h1 class="display text-4xl">{$t("auth.title")}</h1>
      <p class="mt-3 text-sm text-[var(--muted)]">
        {$t("auth.description")}
      </p>
    </div>

    <div class="panel relative overflow-hidden p-6 shadow-lift sm:p-8">
      {#if form?.message || data.errorMessage}
        <!-- Errors use the danger token, not the accent. -->
        <div
          class="mb-6 flex items-start gap-3 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm"
          role="alert"
          aria-live="assertive"
          tabindex="-1"
        >
          <ShieldAlert
            size={20}
            class="shrink-0 text-[var(--danger)]"
            aria-hidden="true"
          />
          <p>{form?.message ?? data.errorMessage}</p>
        </div>
      {:else if data.message}
        <div
          class="mb-6 rounded-md border border-[var(--success)] bg-[var(--success-soft)] p-4 text-sm text-[var(--success)]"
          role="status"
          aria-live="polite"
          tabindex="-1"
        >
          <p>{data.message}</p>
        </div>
      {/if}

      <div
        class="mb-6 grid grid-cols-2 gap-1 rounded border border-[var(--line)] bg-[var(--panel-sunken)] p-1"
        role="tablist"
        aria-label={$t("auth.mode")}
      >
        <button
          type="button"
          role="tab"
          id="auth-tab-sign-in"
          aria-selected={mode === "signIn"}
          aria-controls="auth-sign-in"
          class="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition {mode ===
          'signIn'
            ? 'bg-[var(--fg)] text-[var(--bg)] shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
          onclick={() => (mode = "signIn")}
        >
          <LogIn size={16} aria-hidden="true" />
          {$t("auth.signIn")}
        </button>
        <button
          type="button"
          role="tab"
          id="auth-tab-sign-up"
          aria-selected={mode === "signUp"}
          aria-controls="auth-sign-up"
          class="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition {mode ===
          'signUp'
            ? 'bg-[var(--fg)] text-[var(--bg)] shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'}"
          onclick={() => (mode = "signUp")}
        >
          <UserPlus size={16} aria-hidden="true" />
          {$t("auth.signUp")}
        </button>
      </div>

      <div
        id="auth-sign-in"
        role="tabpanel"
        aria-labelledby="auth-tab-sign-in"
        hidden={mode !== "signIn"}
      >
        <form class="grid gap-5" method="POST" action="?/signIn">
          <input type="hidden" name="redirectTo" value={data.redirectTo} />

          <div class="grid gap-1.5">
            <label for="email" class="field-label">{$t("auth.email")}</label>
            <div class="relative">
              <Mail
                size={16}
                aria-hidden="true"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                id="email"
                class="field pl-9"
                name="email"
                type="email"
                autocomplete="email"
                value={form?.email ?? ""}
                placeholder={$t("auth.emailPlaceholder")}
                required
              />
            </div>
          </div>

          <div class="grid gap-1.5">
            <label for="password" class="field-label"
              >{$t("auth.password")}</label
            >
            <div class="relative">
              <KeyRound
                size={16}
                aria-hidden="true"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                id="password"
                class="field pl-9"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            class="button-primary mt-2 w-full py-2.5 text-base"
            type="submit"
          >
            <LogIn size={16} aria-hidden="true" />
            {$t("auth.signIn")}
          </button>
        </form>

        <button
          type="button"
          class="focus-ring mt-4 inline-flex min-h-11 items-center rounded text-sm font-semibold text-[var(--fg)] underline underline-offset-4 hover:text-[var(--fg-hover)]"
          onclick={() => (showReset = !showReset)}
        >
          {$t("auth.forgot")}
        </button>

        {#if showReset}
          <form
            class="mt-4 grid gap-3 border-t border-[var(--line)] pt-4"
            method="POST"
            action="?/resetPassword"
          >
            <h2 class="text-sm font-semibold text-[var(--fg)]">
              {$t("auth.resetHeading")}
            </h2>
            <label for="reset-email" class="field-label"
              >{$t("auth.email")}</label
            >
            <input
              id="reset-email"
              class="field"
              name="email"
              type="email"
              autocomplete="email"
              placeholder={$t("auth.emailPlaceholder")}
              required
            />
            <button class="button-secondary" type="submit"
              >{$t("auth.sendReset")}</button
            >
          </form>
        {/if}
      </div>

      <div
        id="auth-sign-up"
        role="tabpanel"
        aria-labelledby="auth-tab-sign-up"
        hidden={mode !== "signUp"}
      >
        <form class="grid gap-4" method="POST" action="?/signUp">
          <input type="hidden" name="redirectTo" value={data.redirectTo} />
          <h2 class="text-sm font-semibold text-[var(--fg)]">
            {$t("auth.newAccount")}
          </h2>
          <div class="grid gap-1.5">
            <label for="signup-email" class="field-label"
              >{$t("auth.email")}</label
            >
            <input
              id="signup-email"
              class="field"
              name="email"
              type="email"
              autocomplete="email"
              placeholder={$t("auth.emailPlaceholder")}
              required
            />
          </div>
          <div class="grid gap-1.5">
            <label for="signup-password" class="field-label"
              >{$t("auth.password")}</label
            >
            <input
              id="signup-password"
              class="field"
              name="password"
              type="password"
              autocomplete="new-password"
              placeholder={$t("auth.passwordPlaceholder")}
              minlength="6"
              required
            />
          </div>
          <button class="button-primary w-full py-2.5 text-base" type="submit"
            ><UserPlus size={16} aria-hidden="true" />
            {$t("auth.signUp")}</button
          >
        </form>
      </div>
      {#if $page.data?.nativePlatform}
        <p class="mt-6 text-sm text-[var(--muted)]">{$t("auth.nativeEmail")}</p>
      {:else}
        <SocialSignIn
          providers={data.socialProviders}
          redirectTo={data.redirectTo}
        />
      {/if}
    </div>
  </div>
</div>
