export type ObjectDeletionRow = {
  id: string;
  owner_id: string;
  object_key: string;
  attempt_count: number;
};

export async function processObjectDeletionRows(
  rows: ObjectDeletionRow[],
  bucket: { delete(key: string): Promise<unknown> },
  handlers: {
    deleted(row: ObjectDeletionRow): Promise<void>;
    failed(row: ObjectDeletionRow, reason: string): Promise<void>;
  },
) {
  let deleted = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.object_key.startsWith(`${row.owner_id}/`)) {
      failed += 1;
      await handlers.failed(row, "Object key is outside the owner prefix");
      continue;
    }
    try {
      await bucket.delete(row.object_key);
      await handlers.deleted(row);
      deleted += 1;
    } catch {
      failed += 1;
      await handlers.failed(row, "R2 deletion failed");
    }
  }
  return { attempted: rows.length, deleted, failed };
}
