<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <path d="M3 21V9l9-6 9 6v12" />
  <path d="M7 21v-8h10v8" />
  <path d="M7 17h10" />
</IconBase>
