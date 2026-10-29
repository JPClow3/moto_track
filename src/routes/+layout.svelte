<script lang="ts">
  import { env } from "$env/dynamic/public";
  import "../app.css";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import { requestOfflineFuelSync } from "$lib/utils/offline-fuel";
  import { saveOfflineLocale } from "$lib/utils/offline-cache";
  import ToastRegion from "$lib/components/ui/ToastRegion.svelte";
  import {
    DEFAULT_LOCALE,
    normalizeReleasedLocale,
    type Locale,
  } from "$lib/i18n";

  let {
    data,
    children,
  }: {
    data: { theme?: string; locale?: Locale };
    children: Snippet;
  } = $props();

  const THEME_STORAGE_KEY = "moto-track-theme";
  const THEME_COLORS = { light: "#fafafa", dark: "#09090b" } as const;

  type ThemePreference = "light" | "dark" | "system";
  type ResolvedTheme = Exclude<ThemePreference, "system">;

  function normalizeTheme(theme: string | null | undefined): ThemePreference {
    return theme === "dark" || theme === "light" || theme === "system"
      ? theme
      : "system";
  }

  function applyTheme(theme: string) {
    const preference = normalizeTheme(theme);
    let resolved: ResolvedTheme;

    try {
      resolved =
        preference === "dark" || preference === "light"
          ? preference
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document
        .querySelector("meta[name='theme-color']")
        ?.setAttribute("content", THEME_COLORS[resolved]);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        // Theme rendering remains correct when browser storage is unavailable.
      }
    } catch {
      // Private browsing and strict CSP can make storage or media queries fail.
    }
  }

  $effect(() => {
    if (typeof document === "undefined") return;
    applyTheme(data.theme ?? "system");
  });

  $effect(() => {
    const locale = normalizeReleasedLocale(data.locale) ?? DEFAULT_LOCALE;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    void saveOfflineLocale(locale).catch(() => {});
    let cancelled = false;
    const updateController = () =>
      navigator.serviceWorker.controller?.postMessage({
        type: "SET_LOCALE",
        locale,
      });
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      updateController,
    );
    void navigator.serviceWorker.ready
      .then((registration) => {
        if (!cancelled)
          registration.active?.postMessage({ type: "SET_LOCALE", locale });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        updateController,
      );
    };
  });

  onMount(() => {
    // The browser tests and any client-only integrations can wait for this
    // marker instead of guessing when Svelte hydration has completed.
    document.documentElement.dataset.appReady = "true";

    const dsn = env.PUBLIC_SENTRY_DSN;
    if (dsn) {
      void import("@sentry/browser").then((Sentry) => {
        Sentry.init({
          dsn,
          environment: env.PUBLIC_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
          tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
          sendDefaultPii: false,
        });
      });
    }

    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const syncFuel = () => {
      void requestOfflineFuelSync().catch(() => undefined);
    };
    window.addEventListener("online", syncFuel);
    void navigator.serviceWorker.ready
      .then(() => {
        if (navigator.onLine) syncFuel();
      })
      .catch(() => undefined);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((data.theme ?? "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("online", syncFuel);
    };
  });
</script>

{@render children()}

<ToastRegion />
