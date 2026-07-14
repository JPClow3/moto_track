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
    let form = $$props["form"];
    $$renderer2.push(`<section class="grid gap-6">`);
    FeaturePage($$renderer2, spread_props([data]));
    $$renderer2.push(`<!----><div class="grid gap-6 lg:grid-cols-2"><form class="panel grid gap-2 p-5" method="POST" action="?/savePolicy"><h2 class="font-bold">Seguro</h2><select class="field" name="motorcycle_id" required="">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Moto`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array = ensure_array_like(data.motorcycles);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let m = each_array[$$index];
      $$renderer2.option({ value: m.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(m.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select><input class="field" name="provider" placeholder="Seguradora" required=""/><input class="field" name="policy_number" placeholder="Apólice"/><input class="field" name="coverage_start" type="date" required=""/><input class="field" name="coverage_end" type="date" required=""/><input class="field" name="premium" type="number" step=".01" placeholder="Prêmio"/><input class="field" name="notify_before_days" type="number" value="30"/><button class="button-primary">Salvar seguro</button></form><form class="panel grid gap-2 p-5" method="POST" action="?/saveClaim"><h2 class="font-bold">Sinistro</h2><select class="field" name="policy_id" required="">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Seguro`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_1 = ensure_array_like(data.policies);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let p = each_array_1[$$index_1];
      $$renderer2.option({ value: p.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(p.provider)} · ${escape_html(p.policy_number)}`);
      });
    }
    $$renderer2.push(`<!--]--></select><input class="field" name="claim_date" type="date" required=""/><input class="field" name="description" placeholder="Descrição" required=""/><input class="field" name="amount" type="number" step=".01" placeholder="Valor"/><select class="field" name="status">`);
    $$renderer2.option({ value: "open" }, ($$renderer3) => {
      $$renderer3.push(`Aberto`);
    });
    $$renderer2.option({ value: "settled" }, ($$renderer3) => {
      $$renderer3.push(`Resolvido`);
    });
    $$renderer2.push(`</select><button class="button-secondary">Registrar sinistro</button></form></div><div class="grid gap-2"><!--[-->`);
    const each_array_2 = ensure_array_like(data.policies);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let p = each_array_2[$$index_2];
      $$renderer2.push(`<article class="panel flex justify-between p-4"><span>${escape_html(p.provider)} · vence ${escape_html(p.coverage_end)}</span><form method="POST" action="?/deletePolicy"><input type="hidden" name="id"${attr("value", p.id)}/><button class="button-danger">Excluir</button></form></article>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
