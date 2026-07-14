import { m as head, e as escape_html, b as ensure_array_like, l as attr, i as bind_props } from "../../../../../chunks/index.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = $$props["data"];
    let form = $$props["form"];
    head("49dgds", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(data.article.title)} · Moto Track</title>`);
      });
    });
    $$renderer2.push(`<article class="mx-auto max-w-3xl px-4 py-12 sm:px-6"><h1 class="text-4xl font-black">${escape_html(data.article.title)}</h1><p class="mt-4 text-lg text-[var(--muted)]">${escape_html(data.article.summary)}</p><div class="prose mt-8 max-w-none whitespace-pre-wrap dark:prose-invert">${escape_html(data.article.body)}</div></article><section class="mx-auto max-w-3xl space-y-4 px-4 pb-12"><h2 class="text-2xl font-bold">Comentários</h2>`);
    if (form?.message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-danger">${escape_html(form.message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--><form method="POST" action="?/comment" class="panel grid gap-3 p-4"><textarea class="field min-h-24" name="body" placeholder="Compartilhe sua experiência"></textarea><button class="button-primary w-fit">Comentar</button></form><div class="flex gap-2"><!--[-->`);
    const each_array = ensure_array_like(["👍", "🏍️", "💡"]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let emoji = each_array[$$index];
      $$renderer2.push(`<form method="POST" action="?/react"><input type="hidden" name="emoji"${attr("value", emoji)}/><button class="button-secondary">${escape_html(emoji)} ${escape_html(data.reactions.filter((reaction) => reaction.emoji === emoji).length)}</button></form>`);
    }
    $$renderer2.push(`<!--]--></div><!--[-->`);
    const each_array_1 = ensure_array_like(data.comments);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let comment = each_array_1[$$index_1];
      $$renderer2.push(`<article class="panel p-4"><p>${escape_html(comment.body)}</p><p class="mt-2 text-xs text-[var(--muted)]">${escape_html(comment.author)} · ${escape_html(new Date(comment.created_at).toLocaleDateString("pt-BR"))}</p></article>`);
    }
    $$renderer2.push(`<!--]--></section>`);
    bind_props($$props, { data, form });
  });
}
export {
  _page as default
};
