import { redirect } from "@sveltejs/kit";
function GET({ url }) {
  throw redirect(
    308,
    `/auth?redirectTo=${encodeURIComponent(url.searchParams.get("next") ?? "/dashboard")}`
  );
}
export {
  GET
};
