<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <circle cx="5" cy="16.5" r="3.5" />
  <circle cx="19" cy="16.5" r="3.5" />
  <path d="M5 16.5 8.5 11h6.5l4 5.5" />
  <path d="M8.5 11 10 8h3.5" />
  <path d="M15 11l1.6-4.5H19" />
  <path d="M10 16.5h5" />
</IconBase>
