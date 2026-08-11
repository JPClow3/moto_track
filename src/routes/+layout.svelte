<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";

  let {
    data,
    children,
  }: {
    data: { theme?: string };
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

  onMount(() => {
    // The browser tests and any client-only integrations can wait for this
    // marker instead of guessing when Svelte hydration has completed.
    document.documentElement.dataset.appReady = "true";

    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((data.theme ?? "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  });
</script>

{@render children()}
