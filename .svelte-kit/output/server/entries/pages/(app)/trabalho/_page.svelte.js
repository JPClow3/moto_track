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
    $$renderer2.push(`<!----> <section class="mt-6 grid gap-4 lg:grid-cols-2"><form class="panel grid gap-2 p-4" method="POST" action="?/saveCosts"><h2 class="font-bold">Custos profissionais</h2><select class="field" name="motorcycle_id"><!--[-->`);
    const each_array = ensure_array_like(data.motorcycles);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let m = each_array[$$index];
      $$renderer2.option({ value: m.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(m.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select><input class="field" name="maintenance_reserve" type="number" step=".01" placeholder="Reserva de manutenção por km"/><input class="field" name="depreciation" type="number" step=".01" placeholder="Depreciação por km"/><input class="field" name="fixed_daily_cost" type="number" step=".01" placeholder="Custo fixo diário"/><button class="button-secondary">Salvar custos</button></form><div class="panel p-4"><h2 class="font-bold">Rentabilidade das sessões</h2><!--[-->`);
    const each_array_1 = ensure_array_like(data.summaries);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let s = each_array_1[$$index_1];
      $$renderer2.push(`<p class="mt-2 text-sm">${escape_html(s.work_date)}: lucro R$ ${escape_html((s.profitability.profitCents / 100).toFixed(2))}</p>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
