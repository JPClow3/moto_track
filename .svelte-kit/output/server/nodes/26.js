import * as server from '../entries/pages/auth/_page.server.ts.js';

export const index = 26;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/auth/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/auth/+page.server.ts";
export const imports = ["entries/pages/auth/_page.svelte.js","chunks/index.js"];
export const stylesheets = [];
export const fonts = [];
