# Cloudflare Deployment Checklist

Moto Track runs server-rendered SvelteKit routes on Cloudflare Pages/Workers. Runtime secrets must be configured on the Pages project because server routes read `event.platform.env`; build-time environment variables are not a substitute.

## Pages bindings

Configure the `R2_BUCKET` binding to the `moto-track-media` R2 bucket and the `HYPERDRIVE` binding to the Hyperdrive config pointing at Neon (`DATABASE_URL_DIRECT`, non-pooler host). Add these public runtime variables:

- `PUBLIC_NEON_AUTH_URL`
- `PUBLIC_SITE_URL`
- `PUBLIC_VAPID_KEY`
- `PUBLIC_SENTRY_DSN` (optional; client-visible DSN, and omitting it disables browser Sentry; it may be stored as an encrypted Pages secret)
- `PUBLIC_SENTRY_ENVIRONMENT` (for example `production`)

Set the Sentry variables in the Pages project's **Settings > Variables and Secrets** for each deployed environment (Production and, if used, Preview). The browser reads them through SvelteKit's `$env/dynamic/public`, so they are supplied by the Pages runtime; an encrypted `PUBLIC_SENTRY_DSN` secret is supported and does not need to be decrypted or checked into `wrangler.toml`. The DSN is intentionally public once sent to the browser, not an authorization credential. Never put private credentials or other secrets behind the `PUBLIC_` prefix because SvelteKit exposes that namespace to the client.

Add these as encrypted secrets:

- `NEON_AUTH_JWKS_URL`
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_SECRET`
- `DODO_PRO_MONTHLY_PRODUCT_ID`
- `DODO_PRO_YEARLY_PRODUCT_ID`
- `MISTRAL_API_KEY`
- `VAPID_PRIVATE_KEY`
- `PUSH_ENCRYPTION_KEY`

`MISTRAL_API_KEY` is server-only. Receipt image and PDF OCR fails clearly when it is absent; it never returns fabricated fuel values.

Set the server runtime variable `DODO_PAYMENTS_ENVIRONMENT` to `test_mode` for
Preview or `live_mode` for Production. API keys, webhook signing secret, and
product IDs must belong to that same mode. Never expose them with a `PUBLIC_`
prefix. See [the billing migration runbook](dodo-payments-migration.md) for the
required provider and database cutover checks.

`PUBLIC_VAPID_KEY` / `VAPID_PRIVATE_KEY` / `PUSH_ENCRYPTION_KEY` power browser push subscriptions and the reminder worker send path. Reminder email is sent by the scheduled Worker through its Cloudflare Email Sending `EMAIL` binding; configure `DEFAULT_FROM_EMAIL` on that Worker.

## Neon

1. Run `npm run db:push` against the target Neon branch to apply everything under `db/migrations/`. For Neon, configure `DATABASE_URL_UNPOOLED` with the direct (non-pooler) connection string; the migration runner prefers it over `DATABASE_URL`, which can remain pooled for app traffic.
2. Update `src/lib/types/database.ts` by hand alongside every schema migration; the retired type generator intentionally exits with an error.
3. Authorization is app-layer only — there is no RLS on Neon. Every owner-scoped query must filter by `owner_id`; there is no database-level safety net to fall back on.
4. Confirm privileged columns stay locked: `profiles.is_staff` has no user-facing write path anywhere in the app (see the comment on `isStaffUser` in `src/lib/server/domain/staff.ts`) and `subscription_profiles` billing columns are written only by `billing/webhook/dodo`, `billing/checkout`, `billing/portal`, and the admin account-deletion action. Provider identifiers and status are `billing_customer_id`, `billing_subscription_id`, and `billing_subscription_status`.
5. Confirm the Neon Auth project trusts the Pages preview hostname and the production hostname, and enables localhost origins for development (`http://localhost:5173`) and Playwright (`http://localhost:5187`). Email/password, OAuth, and password-reset flows funnel through `/auth/callback`.
6. CI creates and deletes a disposable Neon branch, including branch-specific Auth, for every authenticated E2E run. Never point E2E at the primary production database.

## Dodo Payments and reminders

1. Create monthly and yearly recurring Pro products in BRL, with the intended R$14.90 monthly and R$99.00 yearly base prices. Confirm price, taxes, cadence, term, and free trial in hosted checkout before using their product IDs as Pages secrets.
2. First Pro subscriptions get a 7-day free trial with a required payment method. The app controls eligibility across both cadences. Returning subscribers pay at checkout. Set no paid trial amount and keep card-optional trial disabled. The selected product renews after the trial until cancellation or its configured term ends.
3. Point the Dodo Payments webhook to `/billing/webhook/dodo` and save that endpoint's signing secret. Select the subscription lifecycle events handled by the route. Confirm signed delivery, duplicate replay, ownership mapping, trial activation, renewal, cancellation, payment failure, and grace expiry in test mode. A return URL alone never grants access. Enable cancellation at the next billing date and disable immediate cancellation in Dodo Payments subscription settings to preserve access through the current period.
4. Apply all pending Neon migrations (including `20260923150000_reminder_worker_run_history.sql`) before deploying Worker code that writes the history table. Then deploy the reminder worker with `npm run worker:deploy` after configuring its `EMAIL` binding, `DEFAULT_FROM_EMAIL`, VAPID/push secrets, trigger token, and confirming its Hyperdrive binding points at the same Neon database.

## Preview acceptance test

On a Pages preview deployment with Dodo Payments test-mode credentials and products, create a user and motorcycle. Confirm that:

1. An image and a PDF receipt populate the fuel form after OCR and save an actual fuel record.
2. Saving fuel, maintenance, tire, or work records updates the motorcycle odometer.
3. A maintenance interval, document expiry, and annual fee each create one linked reminder and updating the source updates that reminder.
4. An uploaded receipt/document downloads only for its owner.
5. Checkout, customer portal access, and a signed Dodo Payments webhook update the subscription profile. An invalid signature is rejected and a duplicate event does not extend access. Exercise both billing cadences, the first-signup trial, returning-subscriber billing, cancellation, payment recovery, and account deletion.
6. Free-plan caps block a second active bike, a 4th upload, a 4th active reminder, and a 4th work session in the same month.
7. Conta export download and deletion confirmation (`EXCLUIR`) create LGPD requests; staff can fulfill them in Admin.
