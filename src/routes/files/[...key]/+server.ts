import { error } from "@sveltejs/kit";
import { requireR2Bucket } from "$server/r2/files";

export async function GET({ params, locals, platform }) {
  const key = params.key;
  if (!locals.user) throw error(401, "Authentication required.");
  const { data: object } = await locals.supabase
    .from("object_files")
    .select("*")
    .eq("owner_id", locals.user.id)
    .eq("object_key", key)
    .maybeSingle();
  if (!object) throw error(404, "File not found");

  const metadata = object as Record<string, unknown>;
  const bucket = await requireR2Bucket(platform);
  const file = await bucket.get(key);
  if (!file) throw error(404, "File not found");
  return new Response(file.body, {
    headers: {
      "content-type": String(
        metadata.content_type ?? "application/octet-stream",
      ),
      "cache-control": "private, max-age=300",
    },
  });
}
