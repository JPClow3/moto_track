import { j as spread_props, b as ensure_array_like, e as escape_html, l as attr, i as bind_props } from "../../../../chunks/index.js";
import { F as FeaturePage } from "../../../../chunks/FeaturePage.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    FeaturePage($$renderer2, spread_props([data]));
    $$renderer2.push(`<!----> <div class="mt-6 grid gap-2 md:grid-cols-2"><!--[-->`);
    const each_array = ensure_array_like(data.rows);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let document = each_array[$$index];
      $$renderer2.push(`<article class="panel flex items-center justify-between gap-3 p-4"><span>${escape_html(document.name)} · ${escape_html(document.valid_until ?? "sem validade")}</span><form method="POST" action="?/createReminder"><input type="hidden" name="id"${attr("value", String(document.id))}/><button class="button-secondary">Criar lembrete</button></form></article>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
