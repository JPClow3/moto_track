<script lang="ts">
  import { t } from "$lib/i18n/store";
  import BrandLogo from "$components/ui/BrandLogo.svelte";
  import ShieldAlert from "lucide-svelte/icons/shield-alert";
  import KeyRound from "lucide-svelte/icons/key-round";
  export let form: { message?: string } | undefined;
  export let data: { token: string };
</script>

<svelte:head><title>{$t("auth.newPassword")} · Moto Track</title></svelte:head>

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
      <h1 class="display text-4xl">{$t("auth.updateHeading")}</h1>
      <p class="mt-3 text-sm text-[var(--muted)]">
        {$t("auth.updateDescription")}
      </p>
    </div>

    <div class="panel relative overflow-hidden p-6 shadow-lift sm:p-8">
      {#if form?.message}
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
          <p>{form.message}</p>
        </div>
      {/if}

      <form class="grid gap-5" method="POST">
        <input type="hidden" name="token" value={data.token} />
        <div class="grid gap-1.5">
          <label for="password" class="field-label"
            >{$t("auth.newPassword")}</label
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
              autocomplete="new-password"
              placeholder={$t("auth.minimumPassword")}
              required
              minlength="6"
            />
          </div>
        </div>

        <div class="grid gap-1.5">
          <label for="confirmPassword" class="field-label"
            >{$t("auth.confirmPassword")}</label
          >
          <div class="relative">
            <KeyRound
              size={16}
              aria-hidden="true"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              id="confirmPassword"
              class="field pl-9"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              required
              minlength="6"
            />
          </div>
        </div>

        <button
          class="button-primary mt-2 w-full py-2.5 text-base"
          type="submit"
        >
          {$t("auth.savePassword")}
        </button>
      </form>
    </div>
  </div>
</div>
