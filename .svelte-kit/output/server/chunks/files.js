import { error } from "@sveltejs/kit";
async function requireR2Bucket(platform) {
  const bucket = platform?.env?.R2_BUCKET;
  if (!bucket) throw error(500, "R2_BUCKET binding is not configured.");
  return bucket;
}
function objectKeyForUpload(ownerId, module, filename) {
  const safeName = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${ownerId}/${module}/${crypto.randomUUID()}-${safeName || "upload.bin"}`;
}
function privateDownloadHeaders(filename, contentType) {
  const safeFilename = filename.replace(/[\r\n"]/g, "_") || "download";
  return new Headers({
    "content-type": contentType,
    "content-disposition": `attachment; filename="${safeFilename}"`,
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=300"
  });
}
async function uploadObjectFile({
  file,
  module,
  ownerId,
  platform
}) {
  const bucket = await requireR2Bucket(platform);
  const objectKey = objectKeyForUpload(ownerId, module, file.name);
  await bucket.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    }
  });
  return {
    objectKey,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    byteSize: file.size
  };
}
export {
  privateDownloadHeaders as p,
  requireR2Bucket as r,
  uploadObjectFile as u
};
