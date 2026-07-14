import { redirect } from "@sveltejs/kit";
function load() {
  throw redirect(308, "/billing/conta");
}
export {
  load
};
