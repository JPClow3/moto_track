import { error } from "@sveltejs/kit";
import type { Sql } from "postgres";

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
    "cache-control": "private, max-age=300",
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
    "cache-control": "private, max-age=300",
  });
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
