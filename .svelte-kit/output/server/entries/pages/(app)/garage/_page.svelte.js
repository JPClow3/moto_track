import { m as head, e as escape_html, b as ensure_array_like, k as attr_class, l as attr, i as bind_props } from "../../../../chunks/index.js";
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
    head("vf802v", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Garagem · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<section class="grid gap-6"><header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm font-semibold uppercase tracking-wide text-signal">Garagem</p><h1 class="text-3xl font-bold">Motos ativas e arquivadas</h1><p class="mt-2 text-sm text-[var(--muted)]">Arquivar preserva todo o histórico e permite restauração posterior.</p></div></header> `);
    if (form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="rounded-md bg-danger/10 p-3 text-sm text-danger">${escape_html(form.message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-6 xl:grid-cols-[1fr_340px]"><div class="grid gap-4 md:grid-cols-2">`);
    const each_array = ensure_array_like(data.motorcycles);
    if (each_array.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let motorcycle = each_array[$$index];
        $$renderer2.push(`<article${attr_class("panel p-5", void 0, { "opacity-70": !motorcycle.is_active })}><div class="flex items-start justify-between gap-3"><div><h2 class="text-xl font-bold">${escape_html(motorcycle.name)}</h2><p class="text-sm text-[var(--muted)]">${escape_html(motorcycle.brand)} ${escape_html(motorcycle.model)} · ${escape_html(motorcycle.year)}</p></div><span${attr_class(`rounded-full px-2 py-1 text-xs ${motorcycle.is_active ? "bg-emerald-500/15" : "bg-black/10"}`)}>${escape_html(motorcycle.is_active ? "Ativa" : "Arquivada")}</span></div> <p class="mt-4 text-3xl font-black">${escape_html(motorcycle.current_odometer_km)} <span class="text-base font-medium">km</span></p> <div class="mt-4 flex flex-wrap gap-2">`);
        if (motorcycle.is_active) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<form method="POST" action="?/archive"><input type="hidden" name="id"${attr("value", motorcycle.id)}/><button class="button-danger" type="submit">Arquivar</button></form>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<form method="POST" action="?/restore"><input type="hidden" name="id"${attr("value", motorcycle.id)}/><button class="button-primary" type="submit">Restaurar</button></form>`);
        }
        $$renderer2.push(`<!--]--></div> `);
        if (motorcycle.is_active) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<details class="mt-4 border-t border-[var(--line)] pt-3"><summary class="cursor-pointer font-semibold">Odômetro e especificações</summary> <form class="mt-3 grid gap-2" method="POST" action="?/updateOdometer"><input type="hidden" name="motorcycle_id"${attr("value", motorcycle.id)}/><label class="grid gap-1 text-sm">Odômetro atual<input class="field" name="odometer_override_km" type="number" min="0"${attr("value", motorcycle.current_odometer_km)}/></label><button class="button-secondary" type="submit">Atualizar odômetro</button></form> <form class="mt-3 grid gap-2" method="POST" action="?/saveSpecs"><input type="hidden" name="motorcycle_id"${attr("value", motorcycle.id)}/><label class="text-sm">Pneu dianteiro<input class="field" name="tire_size_front"${attr("value", motorcycle.motorcycle_specs?.[0]?.tire_size_front ?? "")}/></label><label class="text-sm">Pneu traseiro<input class="field" name="tire_size_rear"${attr("value", motorcycle.motorcycle_specs?.[0]?.tire_size_rear ?? "")}/></label><label class="text-sm">Manual<input class="field" name="manual_reference"${attr("value", motorcycle.motorcycle_specs?.[0]?.manual_reference ?? "")}/></label><button class="button-secondary" type="submit">Salvar especificações</button></form></details>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></article>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="panel p-6 text-[var(--muted)]">Sua garagem está vazia. Cadastre a primeira moto.</p>`);
    }
    $$renderer2.push(`<!--]--></div> <form class="panel grid gap-3 p-5" method="POST" action="?/create"><h2 class="text-lg font-bold">Nova moto</h2><label class="text-sm">Nome<input class="field" name="name" required=""/></label><label class="text-sm">Marca<input class="field" name="brand" required=""/></label><label class="text-sm">Modelo<input class="field" name="model" required=""/></label><label class="text-sm">Ano<input class="field" name="year" type="number" min="1901" required=""/></label><label class="text-sm">Odômetro<input class="field" name="current_odometer_km" type="number" min="0" value="0"/></label><button class="button-primary" type="submit"${attr("disabled", !data.canAddActive, true)}>Cadastrar moto</button>`);
    if (!data.canAddActive) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-xs text-[var(--muted)]">O plano atual atingiu o limite de motos ativas.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></form></div></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
