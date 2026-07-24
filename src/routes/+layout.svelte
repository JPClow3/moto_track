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

  function applyTheme(theme: string) {
    const resolved =
      theme === "dark" || theme === "light"
        ? theme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }

  $effect(() => {
    if (typeof document === "undefined") return;
    applyTheme(data.theme ?? "system");
  });

  onMount(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((data.theme ?? "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  });
</script>

{@render children()}
