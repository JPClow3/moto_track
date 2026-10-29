<script lang="ts" module>
  import type { Snippet } from "svelte";
  import type { SVGAttributes } from "svelte/elements";

  export type IconProps = Omit<SVGAttributes<SVGSVGElement>, "children"> & {
    size?: number | string;
    strokeWidth?: number | string;
  };
</script>

<script lang="ts">
  // Same contract as lucide-svelte (24px grid, 2px round stroke, `size` and
  // `class` props), so a domain icon drops into any lucide icon map.
  let {
    size = 24,
    strokeWidth = 2,
    children,
    ...rest
  }: IconProps & { children: Snippet } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  {...rest}
>
  {@render children()}
</svg>
