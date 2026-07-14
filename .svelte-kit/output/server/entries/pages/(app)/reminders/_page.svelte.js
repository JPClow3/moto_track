import { j as spread_props, i as bind_props } from "../../../../chunks/index.js";
import { F as FeaturePage } from "../../../../chunks/FeaturePage.js";
function _page($$renderer, $$props) {
  let data = $$props["data"];
  FeaturePage($$renderer, spread_props([data]));
  bind_props($$props, { data });
}
export {
  _page as default
};
