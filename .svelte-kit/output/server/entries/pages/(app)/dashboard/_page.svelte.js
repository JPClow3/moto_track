import { m as head, b as ensure_array_like, j as spread_props, e as escape_html, i as bind_props } from "../../../../chunks/index.js";
import { M as MetricCard } from "../../../../chunks/MetricCard.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    head("1tyszyy", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Dashboard · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<section class="grid gap-6"><div><p class="text-sm font-semibold uppercase tracking-wide text-signal">Dashboard</p> <h1 class="text-3xl font-bold">Live motorcycle overview</h1> <p class="mt-2 max-w-3xl text-sm text-[var(--muted)]">Odometer, alerts, fuel cost, reminders, and setup progress across your active motorcycles.</p></div> <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><!--[-->`);
    const each_array = ensure_array_like(data.metrics);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let metric = each_array[$$index];
      MetricCard($$renderer2, spread_props([metric]));
    }
    $$renderer2.push(`<!--]--></div> <div class="grid gap-4 lg:grid-cols-3"><article class="panel p-5"><h2 class="font-semibold">Active reminders</h2> <p class="mt-4 text-4xl font-black">${escape_html(data.alerts.activeReminders)}</p> <p class="mt-2 text-sm text-[var(--muted)]">Due/soon evaluation is handled server-side and by the scheduled worker.</p></article> <article class="panel p-5"><h2 class="font-semibold">Active tires</h2> <p class="mt-4 text-4xl font-black">${escape_html(data.alerts.activeTires)}</p> <p class="mt-2 text-sm text-[var(--muted)]">Wear and replacement indicators feed health scoring.</p></article> <article class="panel p-5"><h2 class="font-semibold">Tracked documents</h2> <p class="mt-4 text-4xl font-black">${escape_html(data.alerts.expiringDocuments)}</p> <p class="mt-2 text-sm text-[var(--muted)]">Expiration dates can create reminders automatically.</p></article></div></section>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
