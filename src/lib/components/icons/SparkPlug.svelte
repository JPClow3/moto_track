<script lang="ts">
  import IconBase, { type IconProps } from "./IconBase.svelte";

  let props: IconProps = $props();
</script>

<IconBase {...props}>
  <path d="M12 2v3" />
  <rect x="9" y="5" width="6" height="4" rx="1" />
  <path d="M10 9h4v5h-4z" />
  <path d="M12 14v4" />
  <path d="M12 18h3v2" />
</IconBase>
