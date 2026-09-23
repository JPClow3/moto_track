import { error } from "@sveltejs/kit";
import type { Sql } from "postgres";

export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_RECEIPT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_UPLOAD_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const RECEIPT_UPLOAD_CONTENT_TYPES = new Set([
  ...DOCUMENT_UPLOAD_CONTENT_TYPES,
  "text/plain",
]);

export type ObjectUploadPolicy = {
  maxBytes: number;
  allowedContentTypes: ReadonlySet<string>;
};

function matchesSignature(type: string, bytes: Uint8Array) {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));

  switch (type) {
    case "application/pdf":
      return ascii(0, 5) === "%PDF-";
    case "image/avif":
      return ascii(4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(8, 4));
    case "image/gif":
      return ["GIF87a", "GIF89a"].includes(ascii(0, 6));
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
    default:
      return true;
  }
}

export async function validateObjectUpload(
  file: File,
  policy: ObjectUploadPolicy,
) {
  if (!file.size) {
    return { ok: false as const, message: "O arquivo está vazio." };
  }
  if (file.size > policy.maxBytes) {
    return {
      ok: false as const,
      message: `O arquivo excede o limite de ${Math.floor(policy.maxBytes / (1024 * 1024))} MB.`,
    };
  }
  if (!policy.allowedContentTypes.has(file.type)) {
    return { ok: false as const, message: "Formato de arquivo não suportado." };
  }
  if (file.type !== "text/plain") {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!matchesSignature(file.type, header)) {
      return {
        ok: false as const,
        message: "O conteúdo do arquivo não corresponde ao formato informado.",
      };
    }
  }
  return { ok: true as const };
}

export async function lockObjectOwner(db: Sql, ownerId: string) {
  const [owner] = await db<Array<{ id: string }>>`
    select id from neon_auth."user"
    where id = ${ownerId}
    for update
  `;
  if (!owner) throw new Error("Account no longer exists.");
}

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

export function privateDownloadHeaders(filename: string, contentType: string) {
  const safeFilename = filename.replace(/[\r\n"]/g, "_") || "download";
  return new Headers({
    "content-type": contentType,
    "content-disposition": `attachment; filename="${safeFilename}"`,
    "x-content-type-options": "nosniff",
    "cache-control": "private, no-store",
  });
}

export function privateImagePreviewHeaders(
  filename: string,
  contentType: string,
) {
  const safeFilename = filename.replace(/[\r\n"]/g, "_") || "photo";
  return new Headers({
    "content-type": contentType,
    "content-disposition": `inline; filename="${safeFilename}"`,
    "x-content-type-options": "nosniff",
    "cache-control": "private, no-store",
  });
}

export async function uploadObjectFile({
  file,
  module,
  ownerId,
  platform,
  policy,
}: {
  file: File;
  module: string;
  ownerId: string;
  platform: App.Platform | undefined;
  policy: ObjectUploadPolicy;
}) {
  const validation = await validateObjectUpload(file, policy);
  if (!validation.ok) throw new Error(validation.message);

  const bucket = await requireR2Bucket(platform);
  const objectKey = objectKeyForUpload(ownerId, module, file.name);
  await bucket.put(objectKey, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  });
  return {
    objectKey,
    filename: file.name,
    contentType: file.type,
    byteSize: file.size,
  };
}

/**
 * Remove objects that are known to belong to an account without allowing a
 * malformed metadata row to target another account's prefix. Database state
 * is authoritative: callers commit their owner-scoped row/metadata deletion
 * first, then use this as best-effort physical cleanup.
 */
export function ownedObjectKeys(ownerId: string, objectKeys: Iterable<string>) {
  const ownerPrefix = `${ownerId}/`;
  return [
    ...new Set(
      [...objectKeys].filter(
        (key) => typeof key === "string" && key.startsWith(ownerPrefix),
      ),
    ),
  ];
}

export async function enqueueObjectDeletions(
  db: Sql,
  ownerId: string,
  objectKeys: Iterable<string>,
) {
  const keys = ownedObjectKeys(ownerId, objectKeys);
  if (keys.length === 0) return [];

  await db`
    insert into object_deletion_queue ${db(
      keys.map((objectKey) => ({
        owner_id: ownerId,
        object_key: objectKey,
      })),
    )}
    on conflict (owner_id, object_key) do update set
      next_attempt_at = now(),
      last_error = '',
      updated_at = now()
  `;
  return keys;
}

export async function deleteOwnedObjectsBestEffort({
  objectKeys,
  ownerId,
  platform,
}: {
  objectKeys: Iterable<string>;
  ownerId: string;
  platform: App.Platform | undefined;
}) {
  const keys = ownedObjectKeys(ownerId, objectKeys);
  if (keys.length === 0) return true;

  const bucket = platform?.env?.R2_BUCKET;
  if (!bucket) return false;

  try {
    await bucket.delete(keys);
    return true;
  } catch {
    // The database rows have already been removed. Keeping the user-facing
    // deletion successful is safer than restoring references to an object
    // that may already have been deleted; R2 lifecycle cleanup can collect a
    // rare orphan after a provider outage.
    return false;
  }
}

/** Attempt queued deletions and clear only rows whose R2 delete completed. */
export async function deleteQueuedObjectsBestEffort({
  db,
  objectKeys,
  ownerId,
  platform,
}: {
  db: Sql;
  objectKeys: Iterable<string>;
  ownerId: string;
  platform: App.Platform | undefined;
}) {
  const keys = ownedObjectKeys(ownerId, objectKeys);
  if (keys.length === 0) return true;

  const deleted = await deleteOwnedObjectsBestEffort({
    objectKeys: keys,
    ownerId,
    platform,
  });
  if (!deleted) {
    await db`
      update object_deletion_queue
      set attempt_count = attempt_count + 1,
        next_attempt_at = now() + interval '5 minutes',
        last_error = 'R2 deletion failed',
        updated_at = now()
      where owner_id = ${ownerId}
        and object_key in ${db(keys)}
    `.catch(() => undefined);
    return false;
  }

  try {
    await db`
      delete from object_deletion_queue
      where owner_id = ${ownerId}
        and object_key in ${db(keys)}
    `;
    return true;
  } catch {
    // R2 deletes are idempotent. Retaining the queue row makes the Worker
    // retry and eventually remove it once Postgres is reachable again.
    return false;
  }
}

/** Persist cleanup for an object uploaded before a failed DB transaction. */
export async function queueUploadedOrphansBestEffort({
  db,
  objectKeys,
  ownerId,
  platform,
}: {
  db: Sql;
  objectKeys: Iterable<string>;
  ownerId: string;
  platform: App.Platform | undefined;
}) {
  const keys = ownedObjectKeys(ownerId, objectKeys);
  if (keys.length === 0) return true;
  try {
    await enqueueObjectDeletions(db, ownerId, keys);
  } catch {
    // A database outage prevents durable enqueueing; still attempt immediate
    // cleanup so a transient persistence failure does not guarantee a leak.
    return deleteOwnedObjectsBestEffort({
      objectKeys: keys,
      ownerId,
      platform,
    });
  }
  return deleteQueuedObjectsBestEffort({
    db,
    objectKeys: keys,
    ownerId,
    platform,
  });
}
