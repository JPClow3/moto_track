import { error } from "@sveltejs/kit";

export async function requireR2Bucket(platform: App.Platform | undefined) {
  const bucket = platform?.env?.R2_BUCKET;
  if (!bucket) throw error(500, "R2_BUCKET binding is not configured.");
  return bucket;
}

export function objectKeyForUpload(
  ownerId: string,
  module: string,
  filename: string,
) {
  const safeName = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${ownerId}/${module}/${crypto.randomUUID()}-${safeName || "upload.bin"}`;
}
