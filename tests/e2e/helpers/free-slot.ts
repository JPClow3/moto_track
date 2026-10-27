import type postgres from "postgres";
import { motorcycleSlots } from "./disposable-db";

type Sql = ReturnType<typeof postgres>;

/**
 * Free plan allows one active motorcycle. Suites that need a clean slot must
 * deactivate existing bikes, verify the count, and restore afterward — without
 * racing a late create from a previous timed-out UI submit.
 */
export async function reserveFreeMotorcycleSlot(sql: Sql, ownerId: string) {
  const previouslyActive = await sql<Array<{ id: string }>>`
    select id from motorcycles
    where owner_id = ${ownerId} and is_active = true and deleted_at is null
  `;
  await sql`
    update motorcycles set is_active = false
    where owner_id = ${ownerId} and is_active = true and deleted_at is null
  `;
  const [count] = await sql<Array<{ n: number }>>`
    select count(*)::int as n from motorcycles
    where owner_id = ${ownerId} and is_active = true and deleted_at is null
  `;
  if (Number(count.n) !== 0) {
    throw new Error(
      `Free motorcycle slot still occupied after deactivate (${await motorcycleSlots(sql, ownerId)})`,
    );
  }
  return {
    previouslyActiveIds: previouslyActive.map((row) => row.id),
    async restore(options?: { deleteMotorcycleIds?: string[] }) {
      const deleteIds = options?.deleteMotorcycleIds ?? [];
      await sql.begin(async (db) => {
        if (deleteIds.length) {
          await db`delete from motorcycles where owner_id = ${ownerId} and id in ${db(deleteIds)}`;
        }
        if (previouslyActive.length) {
          await db`
            update motorcycles set is_active = true
            where owner_id = ${ownerId}
              and id in ${db(previouslyActive.map((row) => row.id))}
              and deleted_at is null
          `;
        }
      });
    },
  };
}
