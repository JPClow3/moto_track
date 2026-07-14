import { m as head, e as escape_html, i as bind_props } from "../../../../../../chunks/index.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    const money = (c) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
    head("1gfj9nq", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Dossiê de venda · ${escape_html(data.motorcycle.name)}</title>`);
      });
    });
    $$renderer2.push(`<section class="print-report mx-auto max-w-3xl space-y-6 svelte-1gfj9nq"><header><p class="text-sm uppercase tracking-wide text-signal">Moto Track · dossiê de venda</p><h1 class="text-4xl font-black">${escape_html(data.motorcycle.name)}</h1><p>${escape_html(data.motorcycle.brand)} ${escape_html(data.motorcycle.model)} · ${escape_html(data.motorcycle.year)} · ${escape_html(data.motorcycle.current_odometer_km)} km</p></header><div class="grid gap-3 sm:grid-cols-2"><article class="panel p-4 svelte-1gfj9nq">Combustível<strong class="block text-2xl">${escape_html(money(data.totals.fuel))}</strong></article><article class="panel p-4 svelte-1gfj9nq">Manutenção<strong class="block text-2xl">${escape_html(money(data.totals.maintenance))}</strong></article><article class="panel p-4 svelte-1gfj9nq">Pneus<strong class="block text-2xl">${escape_html(money(data.totals.tires))}</strong></article><article class="panel p-4 svelte-1gfj9nq">Taxas<strong class="block text-2xl">${escape_html(money(data.totals.fees))}</strong></article></div><button class="button-primary print:hidden svelte-1gfj9nq">Salvar como PDF</button></section>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
