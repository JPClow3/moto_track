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
    $$renderer2.push(`<!----> <section class="mt-6 grid gap-4 lg:grid-cols-2"><form class="panel grid gap-2 p-4" method="POST" action="?/saveProduct"><h2 class="font-bold">Catálogo de pneus</h2><input class="field" name="manufacturer" placeholder="Fabricante" required=""/><input class="field" name="model_name" placeholder="Modelo" required=""/><input class="field" name="tire_type" placeholder="Tipo"/><input class="field" name="price" type="number" step=".01" placeholder="Preço"/><button class="button-secondary">Salvar produto</button></form><form class="panel grid gap-2 p-4" method="POST" action="?/savePressure"><h2 class="font-bold">Pressão</h2><select class="field" name="motorcycle_id"><!--[-->`);
    const each_array = ensure_array_like(data.motorcycles);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let m = each_array[$$index];
      $$renderer2.option({ value: m.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(m.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select><input class="field" name="date" type="date" required=""/><input class="field" name="psi_front" type="number" placeholder="PSI dianteiro" required=""/><input class="field" name="psi_rear" type="number" placeholder="PSI traseiro" required=""/><button class="button-secondary">Registrar pressão</button></form></section>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
