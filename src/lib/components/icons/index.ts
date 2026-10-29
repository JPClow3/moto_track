// Motorcycle-domain icons drawn on lucide's grid (24px, 2px round stroke), for
// the concepts a general-purpose set gets wrong: lucide's `bike` is a bicycle
// and `circle-gauge` is a speedometer, not a tire. Generic UI glyphs (plus,
// x, chevrons, bell, wrench, fuel) still come from lucide-svelte.
//
// Size scale: 16 inline with text, 20 for nav and buttons, 24 for empty
// states and feature blocks.
export { default as Chain } from "./Chain.svelte";
export { default as Helmet } from "./Helmet.svelte";
export { default as Motorcycle } from "./Motorcycle.svelte";
export { default as Odometer } from "./Odometer.svelte";
export { default as OilCan } from "./OilCan.svelte";
export { default as SparkPlug } from "./SparkPlug.svelte";
export { default as Tire } from "./Tire.svelte";
export { default as VehicleDocument } from "./VehicleDocument.svelte";
export { default as VehicleTax } from "./VehicleTax.svelte";
export { default as Workshop } from "./Workshop.svelte";

export const ICON_SIZE = { inline: 16, control: 20, feature: 24 } as const;
