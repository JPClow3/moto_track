

export const index = 22;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(public)/precos/_page.svelte.js')).default;
export const imports = ["entries/pages/(public)/precos/_page.svelte.js","chunks/index.js"];
export const stylesheets = [];
export const fonts = [];
