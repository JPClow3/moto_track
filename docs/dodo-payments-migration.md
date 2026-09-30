# Dodo Payments billing migration and cutover

Updated 29 September 2026. This runbook describes required setup and
acceptance; it does not by itself establish that the provider account,
deployment, database, or customer subscriptions have been migrated.

## Verified setup snapshot

The migration session verified these live-mode products in the account and
through the provider API:

| Cadence | Product ID                  | BRL base price | Payment frequency |
| ------- | --------------------------- | -------------- | ----------------- |
| Monthly | `pdt_0NogzdEPLdVReWwPEmrOr` | R$14.90        | Every 1 Month     |
| Yearly  | `pdt_0Noh00vT9xEg3MP9jHK7e` | R$99.00        | Every 1 Year      |

Both are tax-inclusive SaaS products with a seven-day free trial, no upfront
trial charge, a required payment method, and a 20-year subscription term.
All Dodo Payments verification sections show Approved, and the dashboard
shows **Live payments are active**. The business also hosts Lorebound.
Multiple subscriptions are permitted businesswide so a customer can subscribe
to both applications; Moto Track enforces one open Moto Track plan with its
own persisted checkout/session and subscription guards. Trial misuse prevention
is enabled, immediate cancellation is disabled, and cancellation at the next
billing date is enabled.
Recovery's Subscription Grace Period is enabled for three days, with
**On Hold** after expiry.

No merchant subscriptions were present in the verified setup inventory.
Provider business settings apply across applications, so future changes
must account for both products.

Live monthly and yearly quotes and hosted checkout session creation were
verified without completing a payment. Both quotes show BRL zero due today,
seven trial days, and a required payment method; recurring base amounts are
BRL 1490 and 9900 minor units respectively. These sessions do not prove a
paid charge or completed trial activation.

At setup, the provider API key and webhook signing secret were configured as
encrypted Cloudflare Production runtime secrets. The production webhook
destination was created disabled for activation after the new endpoint deployment.
The initial production Neon inventory found nine Free profiles, no linked billing
customers/subscriptions, and no billing events. A disposable validation
database branch passed the schema upgrade. These results establish setup
and an empty existing billable-subscription handover. This is the setup snapshot;
the [migration PR and production cutover record](https://github.com/JPClow3/moto_track/pull/41)
record the deployed revision, database upgrade, live webhook activation/delivery,
and the limits of completed provider acceptance.

## Product and account setup

1. Confirm the Dodo Payments business is approved for live sales, its legal
   business details and payout account are correct, and Moto Track is an
   approved product. Test-mode setup does not establish live readiness.
2. Create separate monthly and yearly recurring products in each required
   mode. The intended base prices are BRL 1490 minor units every one Month
   and BRL 9900 minor units every one Year. Choose a subscription term
   deliberately: products include a finite subscription period, which is
   separate from payment frequency.
3. Use a seven-day free trial with no paid trial amount. Keep the payment
   method required. The application grants seven days for the first Pro
   signup and zero trial days for returning subscribers across both cadences.
   Explicit checkout trial overrides bypass Dodo Payments' native trial-misuse
   check, so that setting cannot replace app eligibility enforcement.
4. Under Settings → Subscriptions, keep **Allow Cancellation at Next Billing
   Date** enabled and disable **Allow Immediate Cancellation**. Verify invoices
   and payment-method updates in the customer portal. Keep self-service pause
   and unreviewed plan-change options disabled unless their product behavior
   has been accepted.
5. Configure provider grace/recovery settings consistently with the app's
   three-day payment-failure grace policy. Test the resulting timestamps and
   access expiry; do not infer them solely from dashboard toggles.

## Runtime configuration

Set these server-only variables on the Cloudflare Pages environment serving
the billing routes:

| Variable                       | Required value                                      |
| ------------------------------ | --------------------------------------------------- |
| `DODO_PAYMENTS_ENVIRONMENT`    | `test_mode` for preview; `live_mode` for production |
| `DODO_PAYMENTS_API_KEY`        | API key from that mode with required billing access |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Signing secret of the matching endpoint             |
| `DODO_PRO_MONTHLY_PRODUCT_ID`  | Monthly recurring Pro product ID from that mode     |
| `DODO_PRO_YEARLY_PRODUCT_ID`   | Yearly recurring Pro product ID from that mode      |

Keys and webhook secrets belong in encrypted runtime secrets; those credentials
do not belong in `PUBLIC_` variables, Git, test artifacts, logs, or screenshots.
Public prices are fetched from these configured products. Verify BRL base
prices, final checkout taxes, billing cadence, and first charge date in a
real hosted session before promoting configuration.

The database also enforces its billing mode through the singleton
`billing_configuration` row introduced by
`20260929123000_enforce_billing_environment.sql`. Production defaults to
`live_mode`. On a disposable provider test database, explicitly set its mode
to match the preview runtime:

```sql
update public.billing_configuration set environment = 'test_mode' where id = 1;
```

Keep Production at `live_mode`; do not point provider test acceptance at the
production database. Application and SQL Pro guards require a matching
provider/environment. Historical access is limited to its bounded grace
period rather than an old provider's active status.

## Signed webhooks

1. Create an HTTPS webhook endpoint at
   `https://moto-track.net/billing/webhook/dodo` for Production, and the preview
   hostname's equivalent for test mode.
2. Select supported subscription lifecycle events: `subscription.active`,
   `subscription.updated`, `subscription.renewed`, `subscription.plan_changed`,
   `subscription.cancelled`, `subscription.expired`, `subscription.failed`,
   `subscription.on_hold`, `subscription.past_due`, `subscription.paused`,
   `subscription.unpaused`, and `subscription.update_payment_method`. Also
   enable `payment.succeeded`, `payment.failed`, and `payment.cancelled` to
   refresh canonical subscription state. Include `refund.succeeded` and all
   supported `dispute.*` events for the financial-event policy below.
3. Save that endpoint's signing secret in its Pages environment. Dodo Payments
   uses Standard Webhooks headers (`webhook-id`, `webhook-timestamp`, and
   `webhook-signature`); verification uses the original request body.
4. Verify a signed event reaches the deployed endpoint and updates only the
   owning account. Inspect provider delivery status and the persisted event
   record. Invalid signatures must fail, and duplicate deliveries must not
   extend grace or grant access twice.
5. Test delayed/out-of-order deliveries against canonical provider state.
   Unknown products or unmatched owners must never grant Pro. A successful
   checkout redirect alone is insufficient proof of activation.

Dodo Payments emits `subscription.active` when a trial starts after mandate
authorization; there is no native `trialing` status. The first recurring
charge comes after the free trial. Check the account's next billing date and
the provider's zero-amount authorization separately from paid charges.

## Refund and dispute access policy

The signed handler retrieves canonical refund/dispute, payment, and
subscription records and verifies their business, customer, and ownership
linkage. A successful full refund cancels the affected subscription and
revokes its Pro access. A partial refund leaves the subscription in place.
An unresolved or lost dispute also cancels the affected subscription.
A dispute later won or cancelled does not automatically restore a subscription
already stopped by that policy; a new purchase is required. A financial event
for an older subscription must not revoke a separately purchased newer one.

Verify these behaviors on a deployed provider test environment, including
duplicate and delayed events. A change in event filters alone does not prove
financial-event acceptance.

## Account deletion and pending checkout policy

Before local deletion, serialize billing operations for the account, reread
its current provider binding, and inspect every customer record sharing its
normalized email in the Dodo Payments business. Reject another app's or
another owner's customer record even when it has no open subscription:
pending checkout links may still be payable. Also check the customer's
subscriptions for unrelated products. Fail closed and preserve the open
deletion request when blocking would affect another app or owner;
operator support or a dedicated provider business is required for safe
cross-app deletion. Never mass-cancel unrelated subscriptions to fulfill a
Moto Track deletion.

Once that preflight establishes safe isolation, block the Dodo Payments
customer before confirming cancellation. The provider block prevents pending hosted checkout
sessions from taking a payment and skips renewals/retries. Confirm the block's
subscription sweep succeeded; retain local billing records and the open
deletion request when provider termination cannot be verified. Keep a local
deletion tombstone so late signed events cannot recreate access.

Dodo Payments applies a customer block to its normalized email as well as
the customer record throughout the merchant business, including other apps.
A person signing up again with that email therefore
needs operator review before billing can resume. Do not automatically unblock
on signup: unblocking can make an old hosted checkout payable again. Before
approving re-enrollment, reconcile previous sessions, subscriptions, and the
deletion tombstone, and establish the new account's ownership deliberately.
This is an operational billing safeguard; the application must still display
a clear support path for an affected customer.

## Unknown checkout outcomes

Checkout commits the customer binding and a durable `pending:<uuid>` intent
before creating a payable provider session. If the provider result or final
local persistence is uncertain, the pending marker remains and future
checkout attempts fail closed rather than create another payable session.
An operator must reconcile that intent with provider records, its customer,
and any created session before resolving it. Do not clear the marker or
retry checkout creation without establishing the outcome. A known unfinished
session is reused instead of minting another link.

Hosted sessions use Dodo's 24-hour lifetime. Replacement requires proven expiry
and no successful or unresolved payment. If a session was purged, the app
reconciles all customer payments since its provider creation time; missing,
processing, or uncertain records require support review. A completed checkout
is tied to its own canonical payment and subscription before another checkout
can be issued. An older cancelled subscription never proves the new one ended.

## Existing subscription handover

Before applying the billing cutover migration, inventory existing billable
subscriptions, paid-through timestamps, pending cancellations, grace states,
and customers. Store only a secure, minimal operational export outside Git.
The migration must refuse unresolved legacy provider identifiers rather than
reuse them in Dodo Payments API calls.

If there are no existing billable subscriptions, record that verified count
and apply ordered migrations with `npm run db:push` against the intended
Neon database. Check the new `billing_*` identifiers/status and event ledger
schema before deploying the new runtime.

If there are billable customers, coordinate a supported handover with Dodo
Payments. Their managed migration imports eligible payment methods and
subscription data; local column changes do not transfer mandates. Confirm
new customer/subscription identifiers, next charge dates, prices, ownership,
paid-through access, and cancellation state before retiring previous
recurring charges. Alternatively, arrange customer reauthorization through
Dodo Payments checkout and preserve earned access through an explicit,
reviewed transition. Avoid overlapping renewals and never silently reset
already consumed trial eligibility. Do not clear provider IDs or stop an
existing recurring charge merely to make a migration pass. Keep rollback
records until handover and reconciliation succeed.

## Acceptance and production cutover

Run `npm run check`, `npm run format:check`, `npm run lint`,
`npm run test:unit`, and `npm run build`. Run public E2E plus authenticated
E2E against a disposable Neon/Auth environment. A skipped authenticated run
is not billing release proof.

On the deployed test preview, verify monthly and yearly checkout, first Pro
trial, returning-subscriber immediate billing, abandonment, duplicate
checkout protection, signed activation, renewal, failure and grace expiry,
recovery, cancellation through the next billing date, invoice download,
payment-method changes, and account deletion. Verify every Free/Pro cap and
ownership isolation. Provider tests must use provider test credentials rather
than mocks when claiming end-to-end billing acceptance.

Promote only verified live-mode credentials/products and signed webhook
endpoint after database handover is complete. Confirm live checkout opens
with expected amounts and identity, check provider delivery logs, and record
the deployed revision and sanitized acceptance evidence. A checkout session
alone does not prove a charge, renewal, payout, or cancellation. Retire
obsolete payment endpoints, keys, dashboard destinations, dependencies, and
monitoring after successful cutover; removing source references does not
deactivate external recurring charges.

## Official provider references

- [Subscriptions and trials](https://docs.dodopayments.com/features/subscription)
- [Hosted checkout integration](https://docs.dodopayments.com/developer-resources/checkout-session)
- [Customer portal and cancellation controls](https://docs.dodopayments.com/features/customer-portal)
- [Webhook events](https://docs.dodopayments.com/developer-resources/webhooks/intents/webhook-events-guide)
- [Managed subscription migration](https://docs.dodopayments.com/miscellaneous/subscription-migration)
- [Customer blocklist](https://docs.dodopayments.com/features/customer-blocklist)
- [Fees and pricing](https://dodopayments.com/pricing)
