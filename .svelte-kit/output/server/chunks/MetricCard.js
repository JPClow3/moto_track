import { f as fallback, e as escape_html, i as bind_props } from "./index.js";
function MetricCard($$renderer, $$props) {
  let label = $$props["label"];
  let value = $$props["value"];
  let detail = fallback($$props["detail"], "");
  $$renderer.push(`<article class="panel p-4"><p class="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">${escape_html(label)}</p> <p class="mt-3 text-2xl font-bold">${escape_html(value)}</p> `);
  if (detail) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="mt-1 text-sm text-[var(--muted)]">${escape_html(detail)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></article>`);
  bind_props($$props, { label, value, detail });
}
export {
  MetricCard as M
};
