import * as server from '../entries/pages/(app)/dashboard/_page.server.ts.js';

export const index = 6;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/dashboard/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/dashboard/+page.server.ts";
export const imports = ["entries/pages/(app)/dashboard/_page.svelte.js","chunks/index.js","chunks/MetricCard.js"];
export const stylesheets = [];
export const fonts = [];
