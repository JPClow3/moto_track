import { m as head, e as escape_html, l as attr, b as ensure_array_like, i as bind_props } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { M as MetricCard } from "../../../../chunks/MetricCard.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    let form = $$props["form"];
    head("987w4h", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Admin · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<section class="grid gap-6"><div><p class="text-sm font-semibold uppercase tracking-wide text-signal">Admin</p> <h1 class="text-3xl font-bold">Console operacional</h1> <p class="mt-2 text-sm text-[var(--muted)]">Configurações, blog, templates, assinaturas e solicitações de dados.</p></div> `);
    if (form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">${escape_html(form.message)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (!data.isStaff) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="panel p-5 text-danger">Seu perfil não está marcado como staff.</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="grid gap-4 md:grid-cols-4">`);
      MetricCard($$renderer2, { label: "Usuários", value: String(data.counts.users ?? 0) });
      $$renderer2.push(`<!----> `);
      MetricCard($$renderer2, { label: "Artigos", value: String(data.counts.articles ?? 0) });
      $$renderer2.push(`<!----> `);
      MetricCard($$renderer2, {
        label: "Eventos Stripe",
        value: String(data.counts.events ?? 0)
      });
      $$renderer2.push(`<!----> `);
      MetricCard($$renderer2, { label: "Dados", value: String(data.counts.requests ?? 0) });
      $$renderer2.push(`<!----></div> <div class="grid gap-6 xl:grid-cols-2"><form class="panel grid gap-3 p-4" method="POST" action="?/saveSettings"><h2 class="text-lg font-semibold">Configurações do site</h2> <input class="field" name="company_name"${attr("value", data.settings?.company_name ?? "Moto Track")}/> <input class="field" name="support_email"${attr("value", data.settings?.support_email ?? "")} placeholder="Email suporte"/> <div class="grid gap-3 sm:grid-cols-2"><input class="field" name="support_phone"${attr("value", data.settings?.support_phone ?? "")} placeholder="Telefone"/> <input class="field" name="support_whatsapp"${attr("value", data.settings?.support_whatsapp ?? "")} placeholder="WhatsApp"/></div> <div class="grid gap-3 sm:grid-cols-2"><input class="field" name="address_city"${attr("value", data.settings?.address_city ?? "")} placeholder="Cidade"/> <input class="field" name="address_state"${attr("value", data.settings?.address_state ?? "")} placeholder="UF"/></div> <div class="grid gap-3 sm:grid-cols-2"><input class="field" name="dpo_name"${attr("value", data.settings?.dpo_name ?? "")} placeholder="DPO"/> <input class="field" name="dpo_email"${attr("value", data.settings?.dpo_email ?? "")} placeholder="Email DPO"/></div> <button class="button-primary" type="submit">Salvar</button></form> <form class="panel grid gap-3 p-4" method="POST" action="?/createArticle"><h2 class="text-lg font-semibold">Novo artigo</h2> <input class="field" name="title" placeholder="Título" required=""/> <input class="field" name="slug" placeholder="slug opcional"/> <input class="field" name="summary" placeholder="Resumo" required=""/> <textarea class="field min-h-32" name="body" placeholder="Conteúdo" required=""></textarea> <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_published" value="true" checked=""/> Publicado</label> <button class="button-primary" type="submit">Publicar</button></form></div> <div class="grid gap-6 xl:grid-cols-2"><form class="panel grid gap-3 p-4" method="POST" action="?/createTemplate"><h2 class="text-lg font-semibold">Template de moto</h2> <div class="grid gap-3 sm:grid-cols-2"><input class="field" name="brand" placeholder="Marca" required=""/><input class="field" name="model" placeholder="Modelo" required=""/></div> <div class="grid gap-3 sm:grid-cols-4"><input class="field" name="year_from" type="number" placeholder="Ano inicial" required=""/><input class="field" name="year_to" type="number" placeholder="Ano final"/><input class="field" name="engine_cc" type="number" placeholder="cc" required=""/><input class="field" name="country_code" value="BR"/></div> <input class="field" name="variant" placeholder="Versão"/> <button class="button-secondary" type="submit">Criar template</button></form> <div class="panel p-4"><h2 class="text-lg font-semibold">Solicitações de dados</h2> <div class="mt-3 grid gap-2 text-sm">`);
      const each_array = ensure_array_like(data.requests);
      if (each_array.length !== 0) {
        $$renderer2.push("<!--[-->");
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let request = each_array[$$index];
          $$renderer2.push(`<div class="border-t border-[var(--line)] py-2">${escape_html(request.request_type)} · ${escape_html(request.status)} · ${escape_html(request.created_at)}</div>`);
        }
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<p class="text-[var(--muted)]">Sem solicitações abertas.</p>`);
      }
      $$renderer2.push(`<!--]--></div></div></div>`);
    }
    $$renderer2.push(`<!--]--></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
