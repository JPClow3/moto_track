import "clsx";
function PublicHeader($$renderer) {
  $$renderer.push(`<header class="border-b border-[var(--line)] bg-[var(--bg)]"><div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"><a href="/" class="focus-ring flex items-center gap-3 rounded-md"><span class="grid h-9 w-9 place-items-center rounded-md bg-ink text-white">MT</span> <span class="font-semibold">Moto Track</span></a> <nav class="flex items-center gap-2 text-sm"><a class="button-secondary" href="/blog">Blog</a> <a class="button-secondary" href="/precos">Preços</a> <a class="button-primary" href="/auth">Entrar</a></nav></div></header>`);
}
function _layout($$renderer, $$props) {
  let { children } = $$props;
  PublicHeader($$renderer);
  $$renderer.push(`<!----> <main>`);
  children($$renderer);
  $$renderer.push(`<!----></main>`);
}
export {
  _layout as default
};
