import { json } from "@sveltejs/kit";

/**
 * Liveness only. A `select 1` here wakes the Neon compute on every platform
 * probe (Free plan, scale-to-zero), including while the app is otherwise idle.
 */
export function GET() {
  return json({ status: "ok" });
}
