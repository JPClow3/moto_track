<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <path d="M3 16a9 9 0 0 1 18 0v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  <path d="M12 7v6h9" />
</IconBase>
