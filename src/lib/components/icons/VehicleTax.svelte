<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
  <path d="m9 15 6-6" />
  <circle cx="9.5" cy="9.5" r=".5" />
  <circle cx="14.5" cy="14.5" r=".5" />
</IconBase>
