<script lang="ts">
  import { marked } from "marked";
  import MarkdownBlocks from "./MarkdownBlocks.svelte";

  // Article bodies are stored as Markdown (the seed guides lean on GFM tables,
  // task lists and callouts). We lex with `marked` but render the token tree
  // through Svelte components rather than `marked.parse()` + {@html}: Svelte
  // escapes every interpolation, so a body can never inject markup — no
  // DOM-based sanitiser needed, which also keeps this working on Workers.
  export let source = "";

  $: tokens = marked.lexer(source ?? "", { gfm: true });
</script>

<div class="markdown">
  <MarkdownBlocks {tokens} />
</div>
