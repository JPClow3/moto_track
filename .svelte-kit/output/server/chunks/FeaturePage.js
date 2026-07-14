import { f as fallback, e as escape_html, l as attr, b as ensure_array_like, i as bind_props } from "./index.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils2.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
function FeaturePage($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let feature = $$props["feature"];
    let rows = fallback($$props["rows"], () => [], true);
    let motorcycles = fallback($$props["motorcycles"], () => [], true);
    let errorMessage = fallback($$props["errorMessage"], "");
    function valueFor(row, key) {
      const value = row[key];
      if (value === null || value === void 0 || value === "") return "—";
      if (typeof value === "boolean") return value ? "Sim" : "Não";
      if (key.endsWith("_cents") && typeof value === "number") {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
      }
      if (key.endsWith("_millicents") && typeof value === "number") {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 }).format(value / 1e5);
      }
      return String(value);
    }
    $$renderer2.push(`<section class="grid gap-6"><div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p class="text-sm font-semibold uppercase tracking-wide text-signal">${escape_html(feature.slug)}</p> <h1 class="text-3xl font-bold">${escape_html(feature.title)}</h1> <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">${escape_html(feature.subtitle)}</p></div> <a class="button-secondary"${attr("href", `/${feature.slug}/export.csv`)}>Export CSV</a></div> `);
    if (errorMessage) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">${escape_html(errorMessage)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div class="panel overflow-hidden"><div class="overflow-x-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead class="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><tr><!--[-->`);
    const each_array = ensure_array_like(feature.listColumns);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let column = each_array[$$index];
      $$renderer2.push(`<th class="px-4 py-3 font-semibold">${escape_html(column.replaceAll("_", " "))}</th>`);
    }
    $$renderer2.push(`<!--]--><th class="px-4 py-3 font-semibold">Status</th><th class="px-4 py-3 font-semibold">Ações</th></tr></thead><tbody>`);
    const each_array_1 = ensure_array_like(rows);
    if (each_array_1.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index_5 = 0, $$length = each_array_1.length; $$index_5 < $$length; $$index_5++) {
        let row = each_array_1[$$index_5];
        $$renderer2.push(`<tr class="border-b border-[var(--line)]"><!--[-->`);
        const each_array_2 = ensure_array_like(feature.listColumns);
        for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
          let column = each_array_2[$$index_1];
          $$renderer2.push(`<td class="px-4 py-3">${escape_html(valueFor(row, column))}</td>`);
        }
        $$renderer2.push(`<!--]--><td class="px-4 py-3 text-xs text-[var(--muted)]">${escape_html(valueFor(row, "updated_at"))}</td><td class="px-4 py-3"><div class="flex flex-wrap gap-2">`);
        if (feature.slug === "reminders") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<form method="POST" action="?/snoozeDays"><input type="hidden" name="id"${attr("value", String(row.id ?? ""))}/> <input type="hidden" name="days" value="7"/> <button class="button-secondary min-h-8 px-3 py-1 text-xs" type="submit">+7 dias</button></form> <form method="POST" action="?/snoozeKm"><input type="hidden" name="id"${attr("value", String(row.id ?? ""))}/> <input type="hidden" name="km" value="500"/> <button class="button-secondary min-h-8 px-3 py-1 text-xs" type="submit">+500 km</button></form> <form method="POST" action="?/complete"><input type="hidden" name="id"${attr("value", String(row.id ?? ""))}/> <button class="button-primary min-h-8 px-3 py-1 text-xs" type="submit">Concluir</button></form>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <form method="POST"><input type="hidden" name="_intent" value="delete"/> <input type="hidden" name="id"${attr("value", String(row.id ?? ""))}/> <button class="button-danger min-h-8 px-3 py-1 text-xs" type="submit">Excluir</button></form></div></td></tr> <tr class="border-b border-[var(--line)] bg-black/[0.015]"><td class="px-4 py-3"${attr("colspan", feature.listColumns.length + 2)}><details><summary class="cursor-pointer text-sm font-semibold">Editar registro</summary> <form class="mt-3 grid gap-3 md:grid-cols-2" method="POST" enctype="multipart/form-data"><input type="hidden" name="_intent" value="update"/> <input type="hidden" name="id"${attr("value", String(row.id ?? ""))}/> <!--[-->`);
        const each_array_3 = ensure_array_like(feature.fields);
        for (let $$index_4 = 0, $$length2 = each_array_3.length; $$index_4 < $$length2; $$index_4++) {
          let field = each_array_3[$$index_4];
          $$renderer2.push(`<label class="grid gap-1 text-sm"><span class="font-medium">${escape_html(field.label)}</span> `);
          if (field.kind === "textarea") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<textarea class="field min-h-20"${attr("name", field.key)}>`);
            const $$body = escape_html(String(row[field.key] ?? ""));
            if ($$body) {
              $$renderer2.push(`${$$body}`);
            }
            $$renderer2.push(`</textarea>`);
          } else if (field.kind === "boolean") {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`<span class="flex items-center gap-2"><input class="h-4 w-4" type="checkbox"${attr("name", field.key)} value="true"${attr("checked", row[field.key] === true, true)}/> <span class="text-[var(--muted)]">Ativado</span></span>`);
          } else if (field.kind === "file") {
            $$renderer2.push("<!--[2-->");
            $$renderer2.push(`<input class="field"${attr("name", field.key)} type="file"/>`);
          } else if (field.kind === "select") {
            $$renderer2.push("<!--[3-->");
            $$renderer2.select(
              {
                class: "field",
                name: field.key,
                value: String(row[field.key] ?? ""),
                required: field.required
              },
              ($$renderer3) => {
                $$renderer3.option({ value: "" }, ($$renderer4) => {
                  $$renderer4.push(`Selecione`);
                });
                if (field.source === "motorcycles") {
                  $$renderer3.push("<!--[0-->");
                  $$renderer3.push(`<!--[-->`);
                  const each_array_4 = ensure_array_like(motorcycles);
                  for (let $$index_2 = 0, $$length3 = each_array_4.length; $$index_2 < $$length3; $$index_2++) {
                    let motorcycle = each_array_4[$$index_2];
                    $$renderer3.option({ value: motorcycle.id }, ($$renderer4) => {
                      $$renderer4.push(`${escape_html(motorcycle.name)} · ${escape_html(motorcycle.brand)} ${escape_html(motorcycle.model)}`);
                    });
                  }
                  $$renderer3.push(`<!--]-->`);
                } else {
                  $$renderer3.push("<!--[-1-->");
                  $$renderer3.push(`<!--[-->`);
                  const each_array_5 = ensure_array_like(field.options ?? []);
                  for (let $$index_3 = 0, $$length3 = each_array_5.length; $$index_3 < $$length3; $$index_3++) {
                    let option = each_array_5[$$index_3];
                    $$renderer3.option({ value: option.value }, ($$renderer4) => {
                      $$renderer4.push(`${escape_html(option.label)}`);
                    });
                  }
                  $$renderer3.push(`<!--]-->`);
                }
                $$renderer3.push(`<!--]-->`);
              }
            );
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<input class="field"${attr("name", field.key)}${attr("value", String(row[field.key] ?? ""))}${attr("type", field.kind === "date" ? "date" : field.kind === "number" || field.kind === "money" ? "number" : "text")}${attr("step", field.kind === "money" ? "0.01" : "any")}${attr("required", field.required, true)}/>`);
          }
          $$renderer2.push(`<!--]--></label>`);
        }
        $$renderer2.push(`<!--]--> <div class="flex items-end"><button class="button-primary" type="submit">Salvar alterações</button></div></form></details></td></tr>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<tr><td class="px-4 py-12 text-center text-[var(--muted)]"${attr("colspan", feature.listColumns.length + 2)}>Sem registros ainda.</td></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div></div> <form class="panel grid gap-3 p-4" method="POST" enctype="multipart/form-data"><input type="hidden" name="_intent" value="create"/> <div><h2 class="text-lg font-semibold">Novo registro</h2> <p class="text-sm text-[var(--muted)]">Validação server-side com Supabase RLS.</p></div> <!--[-->`);
    const each_array_6 = ensure_array_like(feature.fields);
    for (let $$index_8 = 0, $$length = each_array_6.length; $$index_8 < $$length; $$index_8++) {
      let field = each_array_6[$$index_8];
      $$renderer2.push(`<label class="grid gap-1 text-sm"><span class="font-medium">${escape_html(field.label)}</span> `);
      if (field.kind === "textarea") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<textarea class="field min-h-24"${attr("name", field.key)}${attr("required", field.required, true)}></textarea>`);
      } else if (field.kind === "boolean") {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<span class="flex items-center gap-2"><input class="h-4 w-4" type="checkbox"${attr("name", field.key)} value="true"/> <span class="text-[var(--muted)]">Ativado</span></span>`);
      } else if (field.kind === "file") {
        $$renderer2.push("<!--[2-->");
        $$renderer2.push(`<input class="field"${attr("name", field.key)} type="file"${attr("required", field.required, true)}/>`);
      } else if (field.kind === "select") {
        $$renderer2.push("<!--[3-->");
        $$renderer2.push(`<select class="field"${attr("name", field.key)}${attr("required", field.required, true)}>`);
        $$renderer2.option({ value: "" }, ($$renderer3) => {
          $$renderer3.push(`Selecione`);
        });
        if (field.source === "motorcycles") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<!--[-->`);
          const each_array_7 = ensure_array_like(motorcycles);
          for (let $$index_6 = 0, $$length2 = each_array_7.length; $$index_6 < $$length2; $$index_6++) {
            let motorcycle = each_array_7[$$index_6];
            $$renderer2.option({ value: motorcycle.id }, ($$renderer3) => {
              $$renderer3.push(`${escape_html(motorcycle.name)} · ${escape_html(motorcycle.brand)} ${escape_html(motorcycle.model)}`);
            });
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<!--[-->`);
          const each_array_8 = ensure_array_like(field.options ?? []);
          for (let $$index_7 = 0, $$length2 = each_array_8.length; $$index_7 < $$length2; $$index_7++) {
            let option = each_array_8[$$index_7];
            $$renderer2.option({ value: option.value }, ($$renderer3) => {
              $$renderer3.push(`${escape_html(option.label)}`);
            });
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]--></select>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<input class="field"${attr("name", field.key)}${attr("type", field.kind === "date" ? "date" : field.kind === "number" || field.kind === "money" ? "number" : "text")}${attr("step", field.kind === "money" ? "0.01" : "any")}${attr("required", field.required, true)}/>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (field.help) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="text-xs text-[var(--muted)]">${escape_html(field.help)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></label>`);
    }
    $$renderer2.push(`<!--]--> <button class="button-primary mt-2" type="submit">Salvar</button></form></div></section>`);
    bind_props($$props, { feature, rows, motorcycles, errorMessage });
  });
}
export {
  FeaturePage as F
};
