import * as server from '../entries/pages/(app)/reports/sale/_motorcycleId_/_page.server.ts.js';

export const index = 14;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/reports/sale/_motorcycleId_/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/reports/sale/[motorcycleId]/+page.server.ts";
export const imports = ["entries/pages/(app)/reports/sale/_motorcycleId_/_page.svelte.js","chunks/index.js"];
export const stylesheets = ["_app/immutable/assets/_page.uJ_NdU0G.css"];
export const fonts = [];
