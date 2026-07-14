import { j as spread_props, b as ensure_array_like, e as escape_html, i as bind_props } from "../../../../chunks/index.js";
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
    $$renderer2.push(`<!----> <section class="mt-6 grid gap-4 lg:grid-cols-2"><form class="panel grid gap-2 p-4" method="POST" action="?/savePart"><h2 class="font-bold">Catálogo de peças</h2><input class="field" name="name" placeholder="Peça" required=""/><input class="field" name="manufacturer" placeholder="Fabricante"/><input class="field" name="price" type="number" step=".01" placeholder="Preço"/><input class="field" name="stock_quantity" type="number" value="0"/><label><input name="track_stock" type="checkbox" value="true"/> Controlar estoque</label><button class="button-secondary">Salvar peça</button></form><form class="panel grid gap-2 p-4" method="POST" action="?/savePlan"><h2 class="font-bold">Plano de manutenção</h2><select class="field" name="motorcycle_id"><!--[-->`);
    const each_array = ensure_array_like(data.motorcycles);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let m = each_array[$$index];
      $$renderer2.option({ value: m.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(m.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select><input class="field" name="maintenance_type" placeholder="Tipo" required=""/><input class="field" name="interval_km" type="number" placeholder="Intervalo km"/><input class="field" name="interval_days" type="number" placeholder="Intervalo dias"/><button class="button-secondary">Salvar plano</button></form></section>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
