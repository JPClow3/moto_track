import { e as escape_html, l as attr, b as ensure_array_like, k as attr_class, i as bind_props } from "../../../../chunks/index.js";
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
    const money = (c) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
    $$renderer2.push(`<section class="grid gap-6"><header><p class="text-sm font-semibold uppercase tracking-wide text-signal">Relatórios</p><h1 class="text-3xl font-bold">Linha do tempo e dossiê de venda</h1></header>`);
    if (form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="rounded-md bg-danger/10 p-3 text-danger">${escape_html(form.message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if (form?.publicUrl) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="panel break-all p-4">Link público: <a class="text-signal"${attr("href", form.publicUrl)}>${escape_html(form.publicUrl)}</a></p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--><div class="grid gap-6 lg:grid-cols-2"><form class="panel grid gap-3 p-5" method="GET"><h2 class="font-bold">Filtrar linha do tempo</h2>`);
    $$renderer2.select({ class: "field", name: "source", value: data.filters.source }, ($$renderer3) => {
      $$renderer3.option({ value: "" }, ($$renderer4) => {
        $$renderer4.push(`Todas as fontes`);
      });
      $$renderer3.option({ value: "fuel" }, ($$renderer4) => {
        $$renderer4.push(`Abastecimento`);
      });
      $$renderer3.option({ value: "maintenance" }, ($$renderer4) => {
        $$renderer4.push(`Manutenção`);
      });
      $$renderer3.option({ value: "tires" }, ($$renderer4) => {
        $$renderer4.push(`Pneus`);
      });
      $$renderer3.option({ value: "expenses" }, ($$renderer4) => {
        $$renderer4.push(`Despesas`);
      });
      $$renderer3.option({ value: "work" }, ($$renderer4) => {
        $$renderer4.push(`Trabalho`);
      });
    });
    $$renderer2.push(`<input class="field" name="start" type="date"${attr("value", data.filters.start)}/><input class="field" name="end" type="date"${attr("value", data.filters.end)}/><button class="button-secondary">Aplicar</button></form><form class="panel grid gap-3 p-5" method="POST" action="?/createShare"><h2 class="font-bold">Dossiê público de venda</h2><select class="field" name="motorcycle_id" required="">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Escolha uma moto`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array = ensure_array_like(data.motorcycles);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let moto = each_array[$$index];
      $$renderer2.option({ value: moto.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(moto.name)} · ${escape_html(moto.brand)} ${escape_html(moto.model)}`);
      });
    }
    $$renderer2.push(`<!--]--></select><input class="field" name="days" type="number" min="1" value="14"/><button class="button-primary">Criar link seguro</button></form></div><div class="panel overflow-hidden"><div class="border-b border-[var(--line)] p-4"><h2 class="font-bold">Eventos</h2></div>`);
    const each_array_1 = ensure_array_like(data.timeline);
    if (each_array_1.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let event = each_array_1[$$index_1];
        $$renderer2.push(`<div class="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3"><div><p class="font-medium">${escape_html(event.label)}</p><p class="text-xs text-[var(--muted)]">${escape_html(event.source)} · ${escape_html(event.date)}</p></div><strong${attr_class("", void 0, { "text-danger": event.amountCents > 0 })}>${escape_html(money(event.amountCents))}</strong></div>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="p-6 text-[var(--muted)]">Sem eventos para este filtro.</p>`);
    }
    $$renderer2.push(`<!--]--></div><div class="grid gap-3 md:grid-cols-2"><!--[-->`);
    const each_array_2 = ensure_array_like(data.shares);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let share = each_array_2[$$index_2];
      $$renderer2.push(`<article class="panel flex items-center justify-between gap-3 p-4"><div><p class="font-semibold">${escape_html(share.token_prefix)}…</p><p class="text-xs text-[var(--muted)]">${escape_html(share.access_count)} acessos · expira ${escape_html(new Date(share.expires_at).toLocaleDateString("pt-BR"))}</p></div>`);
      if (!share.revoked_at) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<form method="POST" action="?/revokeShare"><input type="hidden" name="id"${attr("value", share.id)}/><button class="button-danger">Revogar</button></form>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></article>`);
    }
    $$renderer2.push(`<!--]--></div></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
