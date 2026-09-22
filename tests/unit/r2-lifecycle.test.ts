import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import {
  deleteOwnedObjectsBestEffort,
  deleteQueuedObjectsBestEffort,
  queueUploadedOrphansBestEffort,
} from "../../src/lib/server/r2/files";
import {
  processObjectDeletionRows,
  type ObjectDeletionRow,
} from "../../workers/reminders/object-deletion";

function platformWithDelete(deleteObject: (keys: string[]) => Promise<void>) {
  return {
    env: {
      R2_BUCKET: { delete: deleteObject },
    },
  } as unknown as App.Platform;
}

function database() {
  const queries: string[] = [];
  const db = ((
    first: TemplateStringsArray | unknown[],
    ...values: unknown[]
  ) => {
    void values;
    if (Array.isArray(first) && !("raw" in first)) return first;
    const sql = (first as TemplateStringsArray)
      .join("?")
      .replaceAll(/\s+/g, " ")
      .trim();
    queries.push(sql);
    return Promise.resolve([]);
  }) as unknown as Sql;
  return { db, queries };
}

describe("R2 object lifecycle", () => {
  it("deletes each owned key once and refuses keys outside the owner prefix", async () => {
    const deleteObject = vi.fn(async (keys: string[]) => {
      void keys;
    });
    const deleted = await deleteOwnedObjectsBestEffort({
      ownerId: "owner-a",
      objectKeys: [
        "owner-a/documents/one.pdf",
        "owner-a/documents/one.pdf",
        "owner-a/fuel/two.jpg",
        "owner-b/documents/not-owned.pdf",
      ],
      platform: platformWithDelete(deleteObject),
    });

    expect(deleted).toBe(true);
    expect(deleteObject).toHaveBeenCalledOnce();
    expect(deleteObject).toHaveBeenCalledWith([
      "owner-a/documents/one.pdf",
      "owner-a/fuel/two.jpg",
    ]);
  });

  it("keeps database deletion successful when R2 is unavailable", async () => {
    const failingDelete = vi.fn(async () => {
      throw new Error("R2 unavailable");
    });

    await expect(
      deleteOwnedObjectsBestEffort({
        ownerId: "owner-a",
        objectKeys: ["owner-a/maintenance/photo.jpg"],
        platform: platformWithDelete(failingDelete),
      }),
    ).resolves.toBe(false);
    await expect(
      deleteOwnedObjectsBestEffort({
        ownerId: "owner-a",
        objectKeys: ["owner-a/maintenance/photo.jpg"],
        platform: undefined,
      }),
    ).resolves.toBe(false);
  });

  it("persists an upload orphan and clears the queue only after a successful retry", async () => {
    const { db, queries } = database();
    const failingDelete = vi.fn(async () => {
      throw new Error("R2 unavailable");
    });
    await expect(
      queueUploadedOrphansBestEffort({
        db,
        ownerId: "owner-a",
        objectKeys: [
          "owner-a/documents/one.pdf",
          "owner-b/documents/not-owned.pdf",
        ],
        platform: platformWithDelete(failingDelete),
      }),
    ).resolves.toBe(false);
    expect(
      queries.some((sql) =>
        sql.startsWith("insert into object_deletion_queue"),
      ),
    ).toBe(true);
    expect(
      queries.some((sql) => sql.startsWith("update object_deletion_queue")),
    ).toBe(true);
    expect(
      queries.some((sql) =>
        sql.startsWith("delete from object_deletion_queue"),
      ),
    ).toBe(false);

    await expect(
      deleteQueuedObjectsBestEffort({
        db,
        ownerId: "owner-a",
        objectKeys: ["owner-a/documents/one.pdf"],
        platform: platformWithDelete(async () => undefined),
      }),
    ).resolves.toBe(true);
    expect(
      queries.some((sql) =>
        sql.startsWith("delete from object_deletion_queue"),
      ),
    ).toBe(true);
  });

  it("lets the scheduled worker retain a failed row and clear it on retry", async () => {
    const row: ObjectDeletionRow = {
      id: "queue-1",
      owner_id: "owner-a",
      object_key: "owner-a/fuel/receipt.jpg",
      attempt_count: 0,
    };
    let queued = true;
    const failed = vi.fn(async () => undefined);
    const deleted = vi.fn(async () => {
      queued = false;
    });

    const first = await processObjectDeletionRows(
      [row],
      {
        delete: vi.fn(async () => {
          throw new Error("temporary R2 failure");
        }),
      },
      { deleted, failed },
    );
    expect(first).toEqual({ attempted: 1, deleted: 0, failed: 1 });
    expect(queued).toBe(true);
    expect(failed).toHaveBeenCalledWith(row, "R2 deletion failed");

    const second = await processObjectDeletionRows(
      [row],
      { delete: vi.fn(async () => undefined) },
      { deleted, failed },
    );
    expect(second).toEqual({ attempted: 1, deleted: 1, failed: 0 });
    expect(queued).toBe(false);
  });

  it("keeps metadata and source mutations atomic and owner scoped", () => {
    const crud = readFileSync(resolve("src/lib/server/domain/crud.ts"), "utf8");
    const fuel = readFileSync(
      resolve("src/routes/(app)/fuel/+page.server.ts"),
      "utf8",
    );
    const maintenance = readFileSync(
      resolve("src/routes/(app)/maintenance/+page.server.ts"),
      "utf8",
    );
    const admin = readFileSync(
      resolve("src/routes/(app)/admin/+page.server.ts"),
      "utf8",
    );
    const migration = readFileSync(
      resolve("db/migrations/20260922090000_index_object_file_lifecycle.sql"),
      "utf8",
    );
    const workerConfig = readFileSync(
      resolve("workers/reminders/wrangler.toml"),
      "utf8",
    );

    for (const source of [crud, fuel, maintenance]) {
      expect(source).toContain(".begin(async (transaction)");
      expect(source).toContain("enqueueObjectDeletions");
      expect(source).toContain("deleteQueuedObjectsBestEffort");
      expect(source).toContain("owner_id = ${ownerId}");
    }
    expect(admin).toContain(".begin(async (transaction)");
    expect(admin).toContain("enqueueObjectDeletions");
    expect(admin).toContain("deleteQueuedObjectsBestEffort");
    expect(maintenance).toContain("source_table = 'maintenance_photos'");
    expect(admin).toContain("where owner_id = ${existing.owner_id}");
    expect(migration).toContain(
      "create table if not exists public.object_deletion_queue",
    );
    expect(migration).toContain(
      "check (object_key like owner_id::text || '/%')",
    );
    expect(migration).not.toContain(
      'owner_id uuid references neon_auth."user"',
    );
    expect(workerConfig).toContain('binding = "R2_BUCKET"');
    expect(workerConfig).toContain('bucket_name = "moto-track-media"');
  });
});
