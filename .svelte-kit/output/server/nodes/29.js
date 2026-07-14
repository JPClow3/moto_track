

export const index = 29;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/offline/_page.svelte.js')).default;
export const imports = ["entries/pages/offline/_page.svelte.js"];
export const stylesheets = [];
export const fonts = [];
