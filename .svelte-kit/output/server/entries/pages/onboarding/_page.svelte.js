import { e as escape_html, b as ensure_array_like, i as bind_props } from "../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    let form = $$props["form"];
    $$renderer2.push(`<section class="mx-auto grid max-w-xl gap-6"><header><p class="text-sm font-semibold uppercase tracking-wide text-signal">Primeiros passos</p><h1 class="text-3xl font-bold">Vamos conhecer sua moto</h1></header>`);
    if (form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="rounded-md bg-danger/10 p-3 text-sm text-danger">${escape_html(form.message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--><form method="POST" action="?/create" class="panel grid gap-3 p-5"><label class="text-sm">Nome<input class="field" name="name" required=""/></label><label class="text-sm">Marca<input class="field" name="brand" required=""/></label><label class="text-sm">Modelo<input class="field" name="model" required=""/></label><label class="text-sm">Ano<input class="field" name="year" type="number" required=""/></label><label class="text-sm">Template (opcional)<select class="field" name="template_id">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Personalizada`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array = ensure_array_like(data.templates);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let template = each_array[$$index];
      $$renderer2.option({ value: template.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(template.brand)} ${escape_html(template.model)} ${escape_html(template.variant)}`);
      });
    }
    $$renderer2.push(`<!--]--></select></label><button class="button-primary" type="submit">Criar minha moto</button></form><form method="POST" action="?/demo"><button class="button-secondary w-full" type="submit">Explorar com moto de demonstração</button></form></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
