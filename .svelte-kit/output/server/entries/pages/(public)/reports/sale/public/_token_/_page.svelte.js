import { m as head, e as escape_html, i as bind_props } from "../../../../../../../chunks/index.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    head("1d99715", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Public Sale Report · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<article class="mx-auto max-w-4xl px-4 py-12 sm:px-6"><p class="text-sm font-semibold uppercase tracking-wide text-signal">Sale Report</p> <h1 class="mt-3 text-4xl font-black">Motorcycle history dossier</h1> <div class="panel mt-8 p-5"><pre class="overflow-auto text-sm">${escape_html(JSON.stringify(data.share.motorcycles ?? data.share, null, 2))}</pre></div></article>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
