import { redirect } from "@sveltejs/kit";
import type postgres from "postgres";
import {
  billingEnvironment,
  createCheckoutSession,
  customerSubscriptionHistory,
  dodoClient,
  ensureBillingCustomer,
  ExistingSubscriptionError,
  parseBillingInterval,
  TERMINAL_SUBSCRIPTION_STATUSES,
  type BillingEnvironment,
} from "$server/domain/billing";

type Profile = {
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  billing_provider: string | null;
  billing_environment: string | null;
  billing_checkout_session_id: string | null;
  billing_checkout_url: string | null;
};

async function lockAccount(
  tx: postgres.TransactionSql,
  ownerId: string,
  environment: BillingEnvironment,
) {
  await tx`select pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))`;
  const [account] = await tx<
    Array<{
      user_exists: boolean;
      deleted: boolean;
      entitlement_environment: string | null;
    }>
  >`
    select exists (select 1 from neon_auth."user" where id = ${ownerId}) as user_exists,
      exists (select 1 from account_deletion_tombstones where owner_id = ${ownerId}) as deleted,
      (select environment from billing_configuration where id = 1) as entitlement_environment
  `;
  if (
    !account?.user_exists ||
    account.deleted ||
    account.entitlement_environment !== environment
  )
    throw new Error(
      "Account or environment is no longer eligible for billing.",
    );
}
async function readProfile(tx: postgres.TransactionSql, ownerId: string) {
  const [profile] = await tx<Profile[]>`
    select billing_customer_id, billing_subscription_id, billing_provider,
      billing_environment, billing_checkout_session_id, billing_checkout_url
    from subscription_profiles where owner_id = ${ownerId} for update
  `;
  return profile;
}

export async function GET({ locals, url, platform }) {
  const user = locals.user;
  if (!user?.email) {
    const interval = parseBillingInterval(url.searchParams.get("interval"));
    throw redirect(
      303,
      `/auth?redirectTo=${encodeURIComponent(`/billing/checkout?interval=${interval}`)}`,
    );
  }
  let destination: string;
  try {
    const environment = billingEnvironment(platform);
    // Commit the customer binding BEFORE creating any payable checkout. A lost
    // customer response is recovered by exact provider metadata on the next run.
    const customerId = await locals.db.begin(async (tx) => {
      await lockAccount(tx, user.id, environment);
      const profile = await readProfile(tx, user.id);
      if (profile?.billing_provider === "legacy")
        throw new Error(
          "Historical billing requires operator reconciliation before Dodo checkout.",
        );
      if (
        profile?.billing_provider === "dodo" &&
        profile.billing_customer_id &&
        profile.billing_environment !== environment
      )
        throw new Error(
          "Billing profile belongs to another provider environment.",
        );
      const customer = await ensureBillingCustomer({
        email: user.email!,
        userId: user.id,
        customerId:
          profile?.billing_provider === "dodo"
            ? (profile.billing_customer_id ?? undefined)
            : undefined,
        platform,
      });
      await tx`
        insert into subscription_profiles ${tx({
          owner_id: user.id,
          billing_provider: "dodo",
          billing_environment: environment,
          billing_customer_id: customer.customer_id,
        })}
        on conflict (owner_id) do update set
          billing_provider = excluded.billing_provider, billing_environment = excluded.billing_environment,
          billing_customer_id = excluded.billing_customer_id
      `;
      return customer.customer_id;
    });
    // Persist an intent separately from the provider mutation. Its pending ID
    // survives any lost response/failed commit and prevents minting a second link.
    const intent = await locals.db.begin(async (tx) => {
      await lockAccount(tx, user.id, environment);
      const profile = await readProfile(tx, user.id);
      if (
        !profile ||
        profile.billing_customer_id !== customerId ||
        profile.billing_environment !== environment
      )
        throw new Error("Billing customer binding changed.");
      const history = await customerSubscriptionHistory(customerId, platform);
      if (
        history.some(
          (subscription) =>
            !TERMINAL_SUBSCRIPTION_STATUSES.includes(subscription.status),
        )
      )
        return {
          destination: "/billing/portal",
          attemptId: null,
          trialEligible: false,
        };
      if (profile.billing_checkout_session_id) {
        if (profile.billing_checkout_session_id.startsWith("pending:"))
          throw new Error(
            "A previous checkout creation has an uncertain provider outcome; operator review required.",
          );
        if (!profile.billing_checkout_url)
          throw new Error("Stored checkout URL missing.");
        const session = await dodoClient(platform).checkoutSessions.retrieve(
          profile.billing_checkout_session_id,
        );
        if (session.payment_status !== "succeeded")
          return {
            destination: profile.billing_checkout_url,
            attemptId: null,
            trialEligible: false,
          };
        if (history.length === 0) {
          // A successful checkout can precede subscription indexing/webhook
          // delivery. Never mint another payable link during that gap.
          if (!profile.billing_subscription_id)
            throw new Error(
              "Successful checkout is awaiting subscription reconciliation.",
            );
          const previous = await dodoClient(platform).subscriptions.retrieve(
            profile.billing_subscription_id,
          );
          if (previous.customer.customer_id !== customerId)
            throw new Error("Previous subscription customer binding mismatch.");
          if (!TERMINAL_SUBSCRIPTION_STATUSES.includes(previous.status))
            return {
              destination: "/billing/portal",
              attemptId: null,
              trialEligible: false,
            };
        }
      }
      const attemptId = `pending:${crypto.randomUUID()}`;
      await tx`
        update subscription_profiles set billing_checkout_session_id = ${attemptId}, billing_checkout_url = '',
          billing_checkout_created_at = ${new Date().toISOString()} where owner_id = ${user.id}
      `;
      return {
        destination: null,
        attemptId,
        trialEligible: history.length === 0 && !profile.billing_subscription_id,
      };
    });
    if (intent.destination) destination = intent.destination;
    else {
      destination = await locals.db.begin(async (tx) => {
        await lockAccount(tx, user.id, environment);
        const profile = await readProfile(tx, user.id);
        if (
          !intent.attemptId ||
          profile?.billing_checkout_session_id !== intent.attemptId ||
          profile.billing_customer_id !== customerId
        )
          throw new Error("Checkout intent changed.");
        const session = await createCheckoutSession({
          email: user.email!,
          userId: user.id,
          customerId,
          interval: parseBillingInterval(url.searchParams.get("interval")),
          platform,
          trialEligible: intent.trialEligible,
          checkoutKey: intent.attemptId,
        });
        if (!session.checkout_url)
          throw new Error("Dodo checkout URL missing.");
        await tx`
          update subscription_profiles set billing_checkout_session_id = ${session.session_id},
            billing_checkout_url = ${session.checkout_url} where owner_id = ${user.id}
        `;
        return session.checkout_url;
      });
    }
  } catch (error) {
    if (error instanceof ExistingSubscriptionError)
      throw redirect(303, "/billing/portal");
    console.error("Failed to create Dodo checkout session", error);
    throw redirect(303, "/precos?checkout=error");
  }
  throw redirect(303, destination);
}
