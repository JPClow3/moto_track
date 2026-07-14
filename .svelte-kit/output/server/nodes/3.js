

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(public)/_layout.svelte.js')).default;
export const imports = ["entries/pages/(public)/_layout.svelte.js"];
export const stylesheets = [];
export const fonts = [];
