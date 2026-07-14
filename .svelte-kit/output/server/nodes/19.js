

export const index = 19;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(public)/cancelamento/_page.svelte.js')).default;
export const imports = ["entries/pages/(public)/cancelamento/_page.svelte.js"];
export const stylesheets = [];
export const fonts = [];
