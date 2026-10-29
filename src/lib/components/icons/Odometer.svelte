<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <path d="M4 18a9 9 0 1 1 16 0" />
  <path d="m12 13 4-4" />
  <circle cx="12" cy="13" r="1" />
  <rect x="8" y="16" width="8" height="4" rx="1" />
</IconBase>
