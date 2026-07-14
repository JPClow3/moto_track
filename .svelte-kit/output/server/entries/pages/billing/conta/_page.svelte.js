import { m as head, e as escape_html, i as bind_props } from "../../../../chunks/index.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    head("1kuz89s", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Conta · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<section class="grid gap-6"><div><p class="text-sm font-semibold uppercase tracking-wide text-signal">Billing</p> <h1 class="text-3xl font-bold">Conta e assinatura</h1></div> <div class="panel p-5"><p class="text-sm text-[var(--muted)]">Plano atual</p> <p class="mt-2 text-3xl font-black">${escape_html(data.profile?.plan ?? "free")}</p> <div class="mt-4 flex gap-3"><a class="button-primary" href="/billing/checkout">Assinar Pro</a> <a class="button-secondary" href="/billing/portal">Portal Stripe</a></div></div> <div class="panel p-5"><h2 class="font-semibold">Dados pessoais</h2> <div class="mt-4 flex gap-3"><form method="POST" action="?/requestExport"><button class="button-secondary">Solicitar exportação</button></form> <form method="POST" action="?/requestDeletion"><button class="button-danger">Solicitar exclusão</button></form></div></div></section>`);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
