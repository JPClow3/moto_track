<script lang="ts">
  import type { Tokens } from "marked";
  import { isExternalHref, safeHref } from "$lib/markdown";

  // Inline half of the Markdown renderer. See Markdown.svelte for why this
  // walks tokens instead of emitting HTML, and $lib/markdown for why hrefs
  // still need a scheme check on top of that.
  export let tokens: Tokens.Generic[] = [];
</script>

{#each tokens as token (token)}
  {#if token.type === "strong"}
    <strong class="font-semibold text-[var(--fg)]">
      <svelte:self tokens={token.tokens ?? []} />
    </strong>
  {:else if token.type === "em"}
    <em><svelte:self tokens={token.tokens ?? []} /></em>
  {:else if token.type === "del"}
    <del><svelte:self tokens={token.tokens ?? []} /></del>
  {:else if token.type === "codespan"}
    <code class="rounded-sm bg-[var(--accent-soft)] px-1.5 py-0.5 text-[0.85em] text-[var(--accent)]"
      >{token.text}</code
    >
  {:else if token.type === "link"}
    <!-- rel=nofollow: article bodies are staff-authored, but the admin editor
         is still a text field — don't hand out link equity from it.
         An unsafe scheme degrades to plain text rather than a dead link. -->
    {#if safeHref(token.href)}
      <a
        class="font-medium text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)]"
        href={safeHref(token.href)}
        rel="nofollow noopener"
        target={isExternalHref(safeHref(token.href) ?? "") ? "_blank" : null}
      >
        <svelte:self tokens={token.tokens ?? []} />
      </a>
    {:else}
      <svelte:self tokens={token.tokens ?? []} />
    {/if}
  {:else if token.type === "br"}
    <br />
  {:else if token.type === "image"}
    {#if safeHref(token.href)}
      <img class="my-2 rounded" src={safeHref(token.href)} alt={token.text ?? ""} loading="lazy" />
    {/if}
  {:else if token.type === "escape"}
    {token.text}
  {:else if token.tokens?.length}
    <svelte:self tokens={token.tokens} />
  {:else}
    {token.text ?? token.raw ?? ""}
  {/if}
{/each}
