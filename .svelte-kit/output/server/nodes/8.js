import * as server from '../entries/pages/(app)/expenses/_page.server.ts.js';

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/expenses/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/expenses/+page.server.ts";
export const imports = ["entries/pages/(app)/expenses/_page.svelte.js","chunks/index.js","chunks/FeaturePage.js","chunks/exports.js","chunks/utils2.js","chunks/root.js","chunks/false.js","chunks/state.svelte.js"];
export const stylesheets = [];
export const fonts = [];
