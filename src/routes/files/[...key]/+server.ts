import { error } from "@sveltejs/kit";
import { privateDownloadHeaders, requireR2Bucket } from "$server/r2/files";

export async function GET({ params, locals, platform }) {
  const key = params.key;
  if (!locals.user) throw error(401, "Authentication required.");
  const [object] = await locals.db<
    Array<{ filename: string; content_type: string }>
  >`
    select filename, content_type from object_files
    where owner_id = ${locals.user.id} and object_key = ${key}
  `;
  if (!object) throw error(404, "File not found");

  const bucket = await requireR2Bucket(platform);
  const file = await bucket.get(key);
  if (!file) throw error(404, "File not found");
  return new Response(file.body, {
    headers: privateDownloadHeaders(
      object.filename ?? "download",
      object.content_type ?? "application/octet-stream",
    ),
  });
}
