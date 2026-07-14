import { m as head, e as escape_html, l as attr, i as bind_props } from "../../../chunks/index.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    let form = $$props["form"];
    head("1s728sz", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Entrar · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<section class="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2"><div><p class="text-sm font-semibold uppercase tracking-wide text-signal">Moto Track</p> <h1 class="mt-3 text-4xl font-black">Acesse sua garagem.</h1> <p class="mt-4 text-[var(--muted)]">Supabase Auth powers email/password, password recovery, and Google OAuth.</p></div> <div class="panel grid gap-6 p-5">`);
    if (form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="rounded-md bg-signal/15 p-3 text-sm">${escape_html(form.message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <form class="grid gap-3" method="POST" action="?/signIn"><input type="hidden" name="redirectTo"${attr("value", data.redirectTo)}/> <label class="grid gap-1 text-sm">Email <input class="field" name="email" type="email"${attr("value", form?.email ?? "")} required=""/></label> <label class="grid gap-1 text-sm">Senha <input class="field" name="password" type="password" required=""/></label> <button class="button-primary" type="submit">Entrar</button></form> <form method="POST" action="?/google"><button class="button-secondary w-full" type="submit">Entrar com Google</button></form> <details class="rounded-md border border-[var(--line)] p-3"><summary class="cursor-pointer text-sm font-semibold">Criar conta ou recuperar senha</summary> <form class="mt-4 grid gap-3" method="POST" action="?/signUp"><input class="field" name="email" type="email" placeholder="email@exemplo.com" required=""/> <input class="field" name="password" type="password" placeholder="senha" required=""/> <button class="button-secondary" type="submit">Criar conta</button></form> <form class="mt-3 grid gap-3" method="POST" action="?/resetPassword"><input class="field" name="email" type="email" placeholder="email@exemplo.com" required=""/> <button class="button-secondary" type="submit">Enviar recuperação</button></form></details></div></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
