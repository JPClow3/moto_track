<script lang="ts">
  import { t } from "$lib/i18n/store";
  import type { SocialAuthProvider } from "$lib/domain/social-auth";

  let {
    providers,
    redirectTo,
  }: { providers: SocialAuthProvider[]; redirectTo: string } = $props();
</script>

{#if providers.length}
  <div class="relative my-8">
    <div class="absolute inset-0 flex items-center" aria-hidden="true">
      <div class="w-full border-t border-[var(--line)]"></div>
    </div>
    <div class="relative flex justify-center">
      <span class="label-tech bg-[var(--panel)] px-4 text-[var(--muted)]"
        >{$t("auth.continueWith")}</span
      >
    </div>
  </div>

  <div class="grid gap-3">
    {#each providers as provider (provider)}
      <form method="POST" action={`?/${provider}`}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button class="button-secondary w-full py-2.5" type="submit">
          {#if provider === "google"}
            <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          {:else}
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M17.05 12.54c.02 3.04 2.67 4.05 2.7 4.06-.02.07-.42 1.45-1.39 2.88-.84 1.23-1.72 2.46-3.1 2.49-1.35.03-1.79-.8-3.34-.8-1.54 0-2.03.77-3.31.83-1.33.05-2.34-1.33-3.19-2.55-1.73-2.51-3.05-7.09-1.28-10.19.88-1.54 2.45-2.51 4.15-2.54 1.3-.03 2.53.88 3.33.88.8 0 2.31-1.09 3.9-.93.67.03 2.56.27 3.77 2.06-.1.06-2.25 1.31-2.24 3.81zM14.5 5.02c.71-.86 1.19-2.05 1.06-3.24-1.02.04-2.27.68-3 1.54-.66.76-1.24 1.98-1.09 3.15 1.14.09 2.31-.58 3.03-1.45z"
              />
            </svg>
            Apple
          {/if}
        </button>
      </form>
    {/each}
  </div>
{/if}
