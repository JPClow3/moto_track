

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["entries/pages/_page.svelte.js","chunks/index.js"];
export const stylesheets = [];
export const fonts = [];
