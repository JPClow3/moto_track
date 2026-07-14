import { m as head, b as ensure_array_like, l as attr, e as escape_html, i as bind_props } from "../../../../chunks/index.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    head("1j8k0si", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Blog · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<section class="mx-auto max-w-5xl px-4 py-12 sm:px-6"><h1 class="text-4xl font-black">Blog</h1> <div class="mt-8 grid gap-4">`);
    const each_array = ensure_array_like(data.articles);
    if (each_array.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let article = each_array[$$index];
        $$renderer2.push(`<a class="panel block p-5"${attr("href", `/blog/${article.slug}`)}><h2 class="text-xl font-bold">${escape_html(article.title)}</h2> <p class="mt-2 text-sm text-[var(--muted)]">${escape_html(article.summary)}</p></a>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="text-[var(--muted)]">Sem artigos publicados.</p>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
