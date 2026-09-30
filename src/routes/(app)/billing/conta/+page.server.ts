import { fail, type Actions } from "@sveltejs/kit";
import {
  hasProAccess,
  type SubscriptionProfile,
} from "$server/domain/entitlements";
import { isDeletionConfirmation } from "$server/domain/account-data";
import { runtimeEnv } from "$server/runtime";
import { fetchAccountBillingSummary } from "$server/domain/account-billing-summary";

type Row = Record<string, unknown>;

function messageFrom(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function load({ locals, url, platform }) {
  const ownerId = locals.user!.id;
  // Reads are best-effort, matching the old unchecked `.maybeSingle()` /
  // `.select()` calls: a failure yields an empty profile/list instead of
  // failing the whole page load.
  let tokenLoadError = false;
  const [[profile], requests, [userProfile], initialTokens] = await Promise.all(
    [
      locals.db<Row[]>`
      select subscription_profiles.*,
        (select environment from billing_configuration where id = 1) as entitlement_environment
      from subscription_profiles
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
      locals.db<Row[]>`
      select id, name, key_prefix, scopes, is_active, last_used_at, created_at
      from api_tokens where owner_id = ${ownerId} order by created_at desc
    `.catch(() => {
        tokenLoadError = true;
        return [] as Row[];
      }),
    ],
  );
  const normalizeDates = (row: Row): Row =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
    );
  const billingSummary = await fetchAccountBillingSummary(
    profile,
    ownerId,
    platform,
  );
  return {
    profile: profile ? normalizeDates(profile) : null,
    billingSummary,
    initialTokens: initialTokens.map(normalizeDates),
    tokenLoadError,
    hasProAccess: hasProAccess(
      profile as SubscriptionProfile | null,
      new Date(),
      runtimeEnv(platform).DODO_PAYMENTS_ENVIRONMENT ?? "live_mode",
    ),
    theme: userProfile?.theme ?? "system",
    requests: requests.map(normalizeDates),
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
