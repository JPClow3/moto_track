import { fail, type Actions } from "@sveltejs/kit";
import {
  hasProAccess,
  type SubscriptionProfile,
} from "$server/domain/entitlements";
import { isDeletionConfirmation } from "$server/domain/account-data";

type Row = Record<string, unknown>;

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function load({ locals, url }) {
  const ownerId = locals.user!.id;
  // Reads are best-effort, matching the old unchecked `.maybeSingle()` /
  // `.select()` calls: a failure yields an empty profile/list instead of
  // failing the whole page load.
  const [[profile], requests, [userProfile]] = await Promise.all([
    locals.db<Row[]>`
      select * from subscription_profiles
      where owner_id = ${ownerId}
    `.catch(() => [] as Row[]),
    locals.db<Row[]>`
      select * from account_data_requests
      where owner_id = ${ownerId}
      order by created_at desc
    `.catch(() => [] as Row[]),
    locals.db<Array<{ theme: string }>>`
      select theme from profiles where id = ${ownerId}
    `.catch(() => [] as Array<{ theme: string }>),
  ]);
  return {
    profile: profile ?? null,
    hasProAccess: hasProAccess(profile as SubscriptionProfile | null),
    theme: userProfile?.theme ?? "system",
    requests,
    checkout: url.searchParams.get("checkout"),
  };
}

export const actions: Actions = {
  requestExport: async ({ locals }) => {
    try {
      await locals.db`
        insert into account_data_requests ${locals.db({
          owner_id: locals.user!.id,
          request_type: "export",
          status: "open",
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true, message: "Solicitação de exportação registrada." };
  },
  requestDeletion: async ({ request, locals }) => {
    const form = await request.formData();
    const confirmation = String(form.get("confirmation") ?? "");
    if (!isDeletionConfirmation(confirmation)) {
      return fail(400, {
        message: "Digite EXCLUIR para confirmar a exclusão da conta.",
      });
    }
    try {
      await locals.db`
        insert into account_data_requests ${locals.db({
          owner_id: locals.user!.id,
          request_type: "deletion",
          status: "open",
        })}
      `;
    } catch (err) {
      return fail(400, { message: messageFrom(err) });
    }
    return { ok: true, message: "Solicitação de exclusão registrada." };
  },
};
