import * as server from '../entries/pages/(app)/_layout.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/+layout.server.ts";
export const imports = ["entries/pages/(app)/_layout.svelte.js","chunks/index.js"];
export const stylesheets = ["_app/immutable/assets/_layout.DGM4cWfN.css"];
export const fonts = [];
