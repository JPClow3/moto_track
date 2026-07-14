import { e as escape_html, b as ensure_array_like, l as attr, i as bind_props } from "../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let ocr, defaults;
    let data = $$props["data"];
    let form = $$props["form"];
    const brl = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
    const price = (millicents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 3 }).format(millicents / 1e5);
    ocr = form?.ocr;
    defaults = data.preferences[0] ?? {};
    $$renderer2.push(`<section class="grid gap-6"><div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p class="text-sm font-semibold uppercase tracking-wide text-signal">fuel</p> <h1 class="text-3xl font-bold">Abastecimentos</h1> <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">Registro completo com OCR de comprovante, importação CSV, postos, combustíveis, padrões e repetir último.</p></div> <a class="button-secondary" href="/fuel/export.csv">Export CSV</a></div> `);
    if (data.errorMessage || form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">${escape_html(data.errorMessage || form?.message)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-4 md:grid-cols-4"><article class="panel p-4"><p class="text-sm text-[var(--muted)]">Gasto total</p><strong class="text-2xl">${escape_html(brl(data.summary.totalSpend))}</strong></article> <article class="panel p-4"><p class="text-sm text-[var(--muted)]">Litros</p><strong class="text-2xl">${escape_html(data.summary.totalLiters.toFixed(2))}</strong></article> <article class="panel p-4"><p class="text-sm text-[var(--muted)]">Média</p><strong class="text-2xl">${escape_html(data.summary.averageConsumption ?? "—")} km/l</strong></article> <article class="panel p-4"><p class="text-sm text-[var(--muted)]">Custo/km</p><strong class="text-2xl">${escape_html(data.summary.costPerKm ? brl(data.summary.costPerKm * 100) : "—")}</strong></article></div> `);
    if (form?.ocr) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="panel p-4"><h2 class="font-semibold">OCR encontrado</h2> <p class="mt-2 text-sm text-[var(--muted)]">Litros: ${escape_html(form.ocr.liters ?? "—")} · Total: ${escape_html(form.ocr.total_price ? brl(form.ocr.total_price * 100) : "—")} · Preço/l:
        ${escape_html(form.ocr.price_per_liter ? price(form.ocr.price_per_liter * 1e5) : "—")}</p> <p class="mt-2 text-sm text-[var(--muted)]">Os valores foram colocados no novo abastecimento abaixo para revisão.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (form?.previewRows) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="panel p-4"><h2 class="font-semibold">Prévia de importação</h2> <div class="mt-3 overflow-x-auto"><table class="w-full min-w-[720px] text-left text-sm"><thead><tr><th>Linha</th><th>Data</th><th>Km</th><th>Litros</th><th>Total</th><th>Status</th></tr></thead><tbody><!--[-->`);
      const each_array = ensure_array_like(form.previewRows);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let row = each_array[$$index];
        $$renderer2.push(`<tr class="border-t border-[var(--line)]"><td class="py-2">${escape_html(row.row)}</td><td>${escape_html(row.data.date)}</td><td>${escape_html(row.data.odometer_km)}</td><td>${escape_html(row.data.liters)}</td><td>${escape_html(brl(row.data.total_price_cents))}</td><td>${escape_html(row.errors.length ? row.errors.join(" ") : "Válida")}</td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table></div> <form class="mt-4 flex gap-3" method="POST" action="?/importConfirm"><input type="hidden" name="rows_json"${attr("value", form.validRowsJson)}/> <select class="field max-w-xs" name="motorcycle_id">`);
      $$renderer2.option({ value: "" }, ($$renderer3) => {
        $$renderer3.push(`Sem moto`);
      });
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(data.motorcycles);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let moto = each_array_1[$$index_1];
        $$renderer2.option({ value: moto.id }, ($$renderer3) => {
          $$renderer3.push(`${escape_html(moto.name)}`);
        });
      }
      $$renderer2.push(`<!--]--></select> <button class="button-primary" type="submit">Importar linhas válidas</button></form></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><div class="panel overflow-hidden"><div class="overflow-x-auto"><table class="w-full min-w-[820px] text-left text-sm"><thead class="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]"><tr><th class="px-4 py-3">Data</th><th>Km</th><th>Litros</th><th>Total</th><th>Preço/l</th><th>Posto</th><th>Ações</th></tr></thead><tbody>`);
    const each_array_2 = ensure_array_like(data.rows);
    if (each_array_2.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let row = each_array_2[$$index_2];
        $$renderer2.push(`<tr class="border-b border-[var(--line)]"><td class="px-4 py-3">${escape_html(row.date)}</td><td>${escape_html(row.odometer_km)}</td><td>${escape_html(Number(row.liters).toFixed(3))}</td><td>${escape_html(brl(row.total_price_cents))}</td><td>${escape_html(price(row.price_per_liter_millicents))}</td><td>${escape_html(row.station_name || "—")}</td><td><form method="POST" action="?/deleteRecord"><input type="hidden" name="id"${attr("value", row.id)}/> <button class="button-danger min-h-8 px-3 py-1 text-xs" type="submit">Excluir</button></form></td></tr>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<tr><td colspan="7" class="px-4 py-12 text-center text-[var(--muted)]">Sem abastecimentos ainda.</td></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div></div> <div class="grid gap-4"><form class="panel grid gap-3 p-4" method="POST" action="?/createRecord" enctype="multipart/form-data"><h2 class="text-lg font-semibold">Novo abastecimento</h2> <select class="field" name="motorcycle_id">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Moto`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_3 = ensure_array_like(data.motorcycles);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let moto = each_array_3[$$index_3];
      $$renderer2.option({ value: moto.id, selected: defaults.motorcycle_id === moto.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(moto.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select> <input class="field" type="date" name="date"${attr("value", ocr?.date ?? "")} required=""/> <input class="field" type="number" name="odometer_km" placeholder="Odômetro" required=""/> <input class="field" type="number" step="0.001" name="liters" placeholder="Litros"${attr("value", ocr?.liters ?? "")} required=""/> <input class="field" type="number" step="0.01" name="total_price" placeholder="Valor total"${attr("value", ocr?.total_price ?? "")} required=""/> <input class="field" type="number" step="0.001" name="price_per_liter" placeholder="Preço por litro opcional"${attr("value", ocr?.price_per_liter ?? (defaults.price_per_liter_millicents ? defaults.price_per_liter_millicents / 1e5 : ""))}/> <select class="field" name="station_id">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Posto cadastrado`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_4 = ensure_array_like(data.stations);
    for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
      let station = each_array_4[$$index_4];
      $$renderer2.option(
        {
          value: station.id,
          selected: defaults.station_id === station.id
        },
        ($$renderer3) => {
          $$renderer3.push(`${escape_html(station.name)}`);
        }
      );
    }
    $$renderer2.push(`<!--]--></select> <select class="field" name="fuel_grade_id">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Combustível cadastrado`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_5 = ensure_array_like(data.grades);
    for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
      let grade = each_array_5[$$index_5];
      $$renderer2.option(
        {
          value: grade.id,
          selected: defaults.fuel_grade_id === grade.id
        },
        ($$renderer3) => {
          $$renderer3.push(`${escape_html(grade.name)}`);
        }
      );
    }
    $$renderer2.push(`<!--]--></select> <input class="field" name="station_name" placeholder="Nome do posto"${attr("value", defaults.station_name ?? "")}/> <input class="field" name="fuel_type" placeholder="Tipo"${attr("value", defaults.fuel_type ?? "gasoline")}/> <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="tank_full" value="true"${attr("checked", defaults.tank_full ?? true, true)}/> Tanque cheio</label> <textarea class="field" name="notes" placeholder="Observações"></textarea> <input class="field" type="file" name="receipt_file" accept="image/*,.pdf,.txt"/> <button class="button-primary" type="submit">Salvar</button></form> <form class="panel grid gap-3 p-4" method="POST" action="?/repeatLast"><h2 class="text-lg font-semibold">Repetir último</h2> <input class="field" type="date" name="date" required=""/> <input class="field" type="number" name="odometer_km" placeholder="Novo odômetro" required=""/> <input class="field" type="number" step="0.001" name="liters" placeholder="Litros" required=""/> <input class="field" type="number" step="0.01" name="total_price" placeholder="Valor total" required=""/> <button class="button-secondary" type="submit">Repetir dados</button></form></div></div> <div class="grid gap-6 lg:grid-cols-2"><form class="panel grid gap-3 p-4" method="POST" action="?/ocrScan" enctype="multipart/form-data"><h2 class="text-lg font-semibold">OCR de comprovante</h2> <input class="field" type="file" name="receipt_file" accept="image/*,.pdf,.txt" required=""/> <button class="button-secondary" type="submit">Escanear</button></form> <form class="panel grid gap-3 p-4" method="POST" action="?/importPreview" enctype="multipart/form-data"><h2 class="text-lg font-semibold">Importar CSV</h2> <p class="text-sm text-[var(--muted)]">Cabeçalhos: date, odometer_km, liters, total_price, price_per_liter, station_name, fuel_type, tank_full, notes.</p> <input class="field" type="file" name="csv_file" accept=".csv,text/csv" required=""/> <button class="button-secondary" type="submit">Pré-visualizar</button></form></div> <div class="grid gap-6 lg:grid-cols-2"><div class="panel p-4"><h2 class="text-lg font-semibold">Postos</h2> <form class="mt-3 grid gap-3" method="POST" action="?/saveStation"><input class="field" name="name" placeholder="Nome" required=""/> <input class="field" name="brand" placeholder="Bandeira"/> <div class="grid gap-3 sm:grid-cols-2"><input class="field" name="city" placeholder="Cidade"/><input class="field" name="state" placeholder="UF"/></div> <textarea class="field" name="notes" placeholder="Observações"></textarea> <button class="button-secondary" type="submit">Salvar posto</button></form> <div class="mt-4 grid gap-2"><!--[-->`);
    const each_array_6 = ensure_array_like(data.stations);
    for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
      let station = each_array_6[$$index_6];
      $$renderer2.push(`<div class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"><span>${escape_html(station.name)}</span><form method="POST" action="?/deleteStation"><input type="hidden" name="id"${attr("value", station.id)}/><button class="text-danger">Excluir</button></form></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="panel p-4"><h2 class="text-lg font-semibold">Combustíveis</h2> <form class="mt-3 grid gap-3" method="POST" action="?/saveGrade"><input class="field" name="name" placeholder="Nome" required=""/> <input class="field" name="fuel_type" placeholder="Tipo" value="gasoline"/> <div class="grid gap-3 sm:grid-cols-3"><input class="field" name="octane_rating" placeholder="Octanas"/><input class="field" name="ethanol_percentage" placeholder="% etanol"/><input class="field" name="default_price_per_liter" placeholder="Preço padrão"/></div> <textarea class="field" name="notes" placeholder="Observações"></textarea> <button class="button-secondary" type="submit">Salvar combustível</button></form> <div class="mt-4 grid gap-2"><!--[-->`);
    const each_array_7 = ensure_array_like(data.grades);
    for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
      let grade = each_array_7[$$index_7];
      $$renderer2.push(`<div class="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm"><span>${escape_html(grade.name)}</span><form method="POST" action="?/deleteGrade"><input type="hidden" name="id"${attr("value", grade.id)}/><button class="text-danger">Excluir</button></form></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div> <div class="grid gap-6 lg:grid-cols-2"><form class="panel grid gap-3 p-4" method="POST" action="?/saveDefaults"><h2 class="text-lg font-semibold">Padrões</h2> <select class="field" name="motorcycle_id">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Moto`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_8 = ensure_array_like(data.motorcycles);
    for (let $$index_8 = 0, $$length = each_array_8.length; $$index_8 < $$length; $$index_8++) {
      let moto = each_array_8[$$index_8];
      $$renderer2.option({ value: moto.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(moto.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select> <select class="field" name="station_id">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Posto`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_9 = ensure_array_like(data.stations);
    for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
      let station = each_array_9[$$index_9];
      $$renderer2.option({ value: station.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(station.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select> <select class="field" name="fuel_grade_id">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Combustível`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_10 = ensure_array_like(data.grades);
    for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
      let grade = each_array_10[$$index_10];
      $$renderer2.option({ value: grade.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(grade.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select> <input class="field" name="station_name" placeholder="Posto avulso"/> <input class="field" name="fuel_type" value="gasoline"/> <input class="field" name="price_per_liter" placeholder="Preço por litro"/> <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="tank_full" value="true" checked=""/> Tanque cheio por padrão</label> <button class="button-secondary" type="submit">Salvar padrões</button></form> <form class="panel grid gap-3 p-4" method="POST" action="?/saveReviewSettings"><h2 class="text-lg font-semibold">Sugestão de revisão</h2> <select class="field" name="motorcycle_id" required="">`);
    $$renderer2.option({ value: "" }, ($$renderer3) => {
      $$renderer3.push(`Moto`);
    });
    $$renderer2.push(`<!--[-->`);
    const each_array_11 = ensure_array_like(data.motorcycles);
    for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
      let moto = each_array_11[$$index_11];
      $$renderer2.option({ value: moto.id }, ($$renderer3) => {
        $$renderer3.push(`${escape_html(moto.name)}`);
      });
    }
    $$renderer2.push(`<!--]--></select> <input class="field" type="number" min="1" name="fillups_interval" value="10"/> <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" value="true" checked=""/> Ativar sugestão automática</label> <button class="button-secondary" type="submit">Salvar revisão</button></form></div></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
