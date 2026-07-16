import { error } from "@sveltejs/kit";
import { MAINTENANCE_PHOTO_CONTENT_TYPES } from "$server/domain/maintenance-photos";
import { privateImagePreviewHeaders, requireR2Bucket } from "$server/r2/files";

export async function GET({ params, locals, platform }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const { data: photo } = await locals.supabase
    .from("maintenance_photos")
    .select("image_key")
    .eq("id", params.id)
    .eq("owner_id", locals.user.id)
    .maybeSingle();
  if (!photo) throw error(404, "Photo not found.");

  const { data: object } = await locals.supabase
    .from("object_files")
    .select("filename, content_type")
    .eq("owner_id", locals.user.id)
    .eq("object_key", photo.image_key)
    .maybeSingle();
  if (!object || !MAINTENANCE_PHOTO_CONTENT_TYPES.has(object.content_type)) {
    throw error(404, "Photo not found.");
  }

  const bucket = await requireR2Bucket(platform);
  const file = await bucket.get(photo.image_key);
  if (!file) throw error(404, "Photo not found.");
  return new Response(file.body, {
    headers: privateImagePreviewHeaders(object.filename, object.content_type),
  });
}
