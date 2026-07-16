<script lang="ts">
  import type { Tokens } from "marked";
  import MarkdownInline from "./MarkdownInline.svelte";

  // Block half of the Markdown renderer. Recurses via <svelte:self> for the
  // containers (blockquote, list item) that nest further block content.
  export let tokens: Tokens.Generic[] = [];

  const alignOf = (align: string | null) =>
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";
</script>

{#each tokens as token (token)}
  {#if token.type === "heading"}
    <!-- Bodies start at h2: the article <h1> is the page title. -->
    {#if token.depth <= 2}
      <h2 class="display mt-12 scroll-mt-24 text-3xl first:mt-0 sm:text-4xl">
        <MarkdownInline tokens={token.tokens ?? []} />
      </h2>
    {:else if token.depth === 3}
      <h3 class="display mt-9 scroll-mt-24 text-2xl">
        <MarkdownInline tokens={token.tokens ?? []} />
      </h3>
    {:else}
      <h4 class="label-tech mt-8 text-[var(--muted)]">
        <MarkdownInline tokens={token.tokens ?? []} />
      </h4>
    {/if}
  {:else if token.type === "paragraph"}
    <p class="mt-5 leading-relaxed text-[var(--muted)]">
      <MarkdownInline tokens={token.tokens ?? []} />
    </p>
  {:else if token.type === "table"}
    <!-- Spec tables are the backbone of these guides and routinely overflow on
         a phone, so each one scrolls inside its own rail. -->
    <div class="-mx-4 mt-7 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table class="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr class="border-b border-[var(--line)]">
            {#each token.header as cell, i (i)}
              <th
                class="label-tech px-3 py-3 text-[var(--muted)] {alignOf(
                  cell.align,
                )}"
              >
                <MarkdownInline tokens={cell.tokens ?? []} />
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each token.rows as row, r (r)}
            <tr class="border-b border-[var(--line)] last:border-0">
              {#each row as cell, c (c)}
                <td class="px-3 py-3 text-[var(--muted)] {alignOf(cell.align)}">
                  <MarkdownInline tokens={cell.tokens ?? []} />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if token.type === "list"}
    <svelte:element
      this={token.ordered ? "ol" : "ul"}
      class="mt-5 space-y-2.5"
      start={token.ordered && token.start !== 1 ? token.start : null}
    >
      {#each token.items as item, i (i)}
        <li class="flex items-start gap-3">
          {#if item.task}
            <!-- Checklist posts render as a real checklist, not "[ ] item". -->
            <span
              class="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-sm border {item.checked
                ? 'border-transparent bg-[var(--accent-solid)]'
                : 'border-[var(--line)]'}"
              aria-hidden="true"
            >
              {#if item.checked}
                <svg
                  viewBox="0 0 12 12"
                  class="h-2.5 w-2.5 text-white"
                  fill="none"
                >
                  <path
                    d="M2 6.2 4.6 8.8 10 3.4"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              {/if}
            </span>
          {:else if token.ordered}
            <span
              class="display numeric mt-px w-5 shrink-0 text-[var(--accent)]"
            >
              {(token.start ?? 1) + i}.
            </span>
          {:else}
            <span class="tick" aria-hidden="true"></span>
          {/if}
          <div class="markdown-tight min-w-0 flex-1 text-[var(--muted)]">
            <svelte:self tokens={item.tokens ?? []} />
          </div>
        </li>
      {/each}
    </svelte:element>
  {:else if token.type === "blockquote"}
    <!-- Every recovered guide closes on a "Dica do Moto Track" callout, so this
         is a real component, not a decoration. -->
    <blockquote
      class="markdown-tight mt-7 rounded border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-4 text-[var(--muted)]"
    >
      <svelte:self tokens={token.tokens ?? []} />
    </blockquote>
  {:else if token.type === "code"}
    <pre
      class="mt-6 overflow-x-auto rounded bg-ink p-4 text-sm text-paper"><code
        >{token.text}</code
      ></pre>
  {:else if token.type === "hr"}
    <hr class="mt-10 border-[var(--line)]" />
  {:else if token.type === "text"}
    {#if token.tokens?.length}
      <MarkdownInline tokens={token.tokens} />
    {:else}
      {token.text ?? ""}
    {/if}
  {:else if token.type === "html"}
    <!-- Raw HTML in a body is dropped rather than injected: rendering it would
         mean {@html} on admin-editable text. -->
  {/if}
{/each}

<style>
  /* Inside a list item or callout the first block must not re-introduce the
     top margin the container already provides. */
  .markdown-tight :global(> :first-child) {
    margin-top: 0;
  }
</style>
