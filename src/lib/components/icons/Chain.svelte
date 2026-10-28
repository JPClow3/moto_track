<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <rect x="2" y="9" width="11" height="6" rx="3" />
  <rect x="11" y="9" width="11" height="6" rx="3" />
</IconBase>
