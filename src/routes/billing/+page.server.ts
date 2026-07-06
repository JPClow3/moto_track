import { redirect } from "@sveltejs/kit";
export function load() {
  throw redirect(308, "/billing/conta");
}
