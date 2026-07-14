import * as server from '../entries/pages/(app)/admin/_page.server.ts.js';

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/admin/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/admin/+page.server.ts";
export const imports = ["entries/pages/(app)/admin/_page.svelte.js","chunks/index.js","chunks/exports.js","chunks/utils2.js","chunks/root.js","chunks/false.js","chunks/state.svelte.js","chunks/MetricCard.js"];
export const stylesheets = [];
export const fonts = [];
