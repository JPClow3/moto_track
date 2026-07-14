import { redirect } from "@sveltejs/kit";
function GET() {
  throw redirect(308, "/auth");
}
export {
  GET
};
