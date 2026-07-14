

export const index = 20;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(public)/lgpd/_page.svelte.js')).default;
export const imports = ["entries/pages/(public)/lgpd/_page.svelte.js"];
export const stylesheets = [];
export const fonts = [];
