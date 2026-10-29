import { error } from "@sveltejs/kit";
import { ACCOUNT_EXPORT_TABLES } from "$server/domain/account-data";
import { exportMessages, exportText } from "$lib/i18n/exports";

export async function GET({ locals }) {
  const copy = exportMessages(locals.locale);
  if (!locals.user) throw error(401, copy.authenticationRequired);
  const ownerId = locals.user.id;
  const db = locals.db;

  const records: Array<readonly [string, Record<string, unknown>[]]> =
    await Promise.all(
      ACCOUNT_EXPORT_TABLES.map(async (table) => {
        let rows: Record<string, unknown>[];
        try {
          rows =
            table === "offline_fuel_submissions"
              ? await db<Record<string, unknown>[]>`
                select id, accepted_at, deleted_at from offline_fuel_submissions
                where owner_id = ${ownerId}
              `
              : await db<Record<string, unknown>[]>`
          select * from ${db(table)}
          where owner_id = ${ownerId}
        `;
        } catch {
          throw error(
            500,
            exportText(locals.locale, "exportTableFailed", { table }),
          );
        }
        return [table, rows] as const;
      }),
    );

  const [receivedAccess, contributedActivity, workshopContributions] =
    await Promise.all([
      db<
        Record<string, unknown>[]
      >`select * from garage_memberships where member_id = ${ownerId}`,
      db<
        Record<string, unknown>[]
      >`select * from garage_activity where actor_id = ${ownerId}`,
      db<Record<string, unknown>[]>`
      select c.* from anonymous_workshop_benchmark_contributions c
      join workshop_benchmark_submission_guards g on g.contribution_id = c.id
      where g.owner_id = ${ownerId}
    `,
    ]);
  records.push(["received_garage_memberships", receivedAccess]);
  records.push(["contributed_garage_activity", contributedActivity]);
  records.push(["workshop_benchmark_contributions", workshopContributions]);

  let profile: Record<string, unknown> | undefined;
  try {
    [profile] = await db<Record<string, unknown>[]>`
      select id, email, full_name, theme, preferred_locale, created_at, updated_at
      from profiles
      where id = ${ownerId}
    `;
  } catch {
    throw error(500, copy.exportProfileFailed);
  }

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: profile ?? null,
      records: Object.fromEntries(records),
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${copy.accountFilename}"`,
      "content-type": "application/json; charset=utf-8",
      "content-language": locals.locale,
      "x-content-type-options": "nosniff",
    },
  });
}
