<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <path d="M4 10h8l3 3 6-3-5 7H6a2 2 0 0 1-2-2z" />
  <path d="M8 10V7h3" />
  <path d="M6.5 7h6" />
  <path d="M21 15v2" />
</IconBase>
