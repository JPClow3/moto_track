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

export async function uploadObjectFile({
  file,
  module,
  ownerId,
  platform,
}: {
  file: File;
  module: string;
  ownerId: string;
  platform: App.Platform | undefined;
}) {
  const bucket = await requireR2Bucket(platform);
  const objectKey = objectKeyForUpload(ownerId, module, file.name);
  await bucket.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });
  return {
    objectKey,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    byteSize: file.size,
  };
}
