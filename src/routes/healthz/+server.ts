import { json } from "@sveltejs/kit";
import { getDb } from "$server/db/client";

export async function GET({ platform }) {
  try {
    await getDb(platform)`select 1`;
    return json({ status: "ok" });
  } catch {
    return json({ status: "error" }, { status: 503 });
  }
}
