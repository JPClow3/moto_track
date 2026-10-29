<script lang="ts" module>
  /** ok → green, due → amber, overdue → red (the only red in the app body),
   *  info → steel blue, neutral → muted. Map domain states onto these rather
   *  than picking colours per page. */
  export type StatusTone = "ok" | "due" | "overdue" | "info" | "neutral";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    tone = "neutral",
    children,
    class: className = "",
  }: { tone?: StatusTone; children: Snippet; class?: string } = $props();
</script>

<span class="status-badge {className}" data-tone={tone}>
  <span class="dot" aria-hidden="true"></span>
  {@render children()}
</span>

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
    border-radius: 9999px;
    padding: 0.125rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.25rem;
    white-space: nowrap;
    color: var(--muted);
    background: color-mix(in srgb, var(--fg) 6%, transparent);
  }

  .dot {
    width: 0.4375rem;
    height: 0.4375rem;
    border-radius: 9999px;
    background: currentColor;
  }

  [data-tone="ok"] {
    color: var(--success);
    background: var(--success-soft);
  }

  [data-tone="due"] {
    color: var(--warning);
    background: var(--warning-soft);
  }

  [data-tone="overdue"] {
    color: var(--accent);
    background: var(--accent-soft);
  }

  [data-tone="info"] {
    color: var(--info);
    background: var(--info-soft);
  }
</style>
