import * as server from '../entries/pages/billing/conta/_page.server.ts.js';

export const index = 28;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/billing/conta/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/billing/conta/+page.server.ts";
export const imports = ["entries/pages/billing/conta/_page.svelte.js","chunks/index.js"];
export const stylesheets = [];
export const fonts = [];
