import { error } from "@sveltejs/kit";
import { MAINTENANCE_PHOTO_CONTENT_TYPES } from "$server/domain/maintenance-photos";
import { privateImagePreviewHeaders, requireR2Bucket } from "$server/r2/files";

export async function GET({ params, locals, platform }) {
  if (!locals.user) throw error(401, "Authentication required.");
  const ownerId = locals.user.id;

  let photo: { image_key: string } | undefined;
  try {
    [photo] = await locals.db<Array<{ image_key: string }>>`
      select image_key from maintenance_photos
      where id = ${params.id} and owner_id = ${ownerId}
    `;
  } catch {
    throw error(404, "Photo not found.");
  }
  if (!photo) throw error(404, "Photo not found.");

  let object: { filename: string; content_type: string } | undefined;
  try {
    [object] = await locals.db<
      Array<{ filename: string; content_type: string }>
    >`
      select filename, content_type from object_files
      where owner_id = ${ownerId} and object_key = ${photo.image_key}
    `;
  } catch {
    throw error(404, "Photo not found.");
  }
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
