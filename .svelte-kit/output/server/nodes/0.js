

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["entries/pages/_layout.svelte.js"];
export const stylesheets = ["_app/immutable/assets/_layout.D_2i0m1I.css"];
export const fonts = [];
