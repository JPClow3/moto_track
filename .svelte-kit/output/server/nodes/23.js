import * as server from '../entries/pages/(public)/reports/sale/public/_token_/_page.server.ts.js';

export const index = 23;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(public)/reports/sale/public/_token_/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/(public)/reports/sale/public/[token]/+page.server.ts";
export const imports = ["entries/pages/(public)/reports/sale/public/_token_/_page.svelte.js","chunks/index.js"];
export const stylesheets = [];
export const fonts = [];
