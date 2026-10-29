<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <rect x="3" y="5" width="18" height="14" rx="2" />
  <circle cx="8.5" cy="11" r="2" />
  <path d="M6 16h5" />
  <path d="M14 10h4M14 14h4" />
</IconBase>
