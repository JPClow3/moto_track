# Cloudflare Deployment Checklist

Moto Track runs server-rendered SvelteKit routes on Cloudflare Pages/Workers. Runtime secrets must be configured on the Pages project because server routes read `event.platform.env`; build-time environment variables are not a substitute.

## Pages bindings

Configure the `R2_BUCKET` binding to the `moto-track-media` R2 bucket and the `HYPERDRIVE` binding to the Hyperdrive config pointing at Neon (`DATABASE_URL_DIRECT`, non-pooler host). Add these plaintext variables:

- `PUBLIC_NEON_AUTH_URL`
- `PUBLIC_SITE_URL`
- `PUBLIC_VAPID_KEY`

Add these as encrypted secrets:

- `DATABASE_URL` (pooled endpoint; local dev/scripts only — Pages/Workers use the Hyperdrive binding instead)
- `NEON_AUTH_JWKS_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `MISTRAL_API_KEY`
- `RESEND_API_KEY`
- `DEFAULT_FROM_EMAIL`
- `VAPID_PRIVATE_KEY`
- `PUSH_ENCRYPTION_KEY`

`MISTRAL_API_KEY` is server-only. Receipt image and PDF OCR fails clearly when it is absent; it never returns fabricated fuel values.

`PUBLIC_VAPID_KEY` / `VAPID_PRIVATE_KEY` / `PUSH_ENCRYPTION_KEY` power browser push subscriptions and the reminder worker send path. `RESEND_API_KEY` is used in-process for transactional email (no Edge Function hop).

## Neon

1. Run `npm run db:push` against the target Neon branch to apply everything under `db/migrations/`.
2. Run `node scripts/generate-db-types.mjs` and commit any generated type changes.
3. Authorization is app-layer only — there is no RLS on Neon. Every owner-scoped query must filter by `owner_id`; there is no database-level safety net to fall back on.
4. Confirm privileged columns stay locked: `profiles.is_staff` has no user-facing write path anywhere in the app (see the comment on `isStaffUser` in `src/lib/server/domain/staff.ts`) and `subscription_profiles` billing columns are written only by `billing/webhook/stripe`, `billing/checkout`, `billing/portal`, and the admin account-deletion action.
5. Confirm the Neon Auth project trusts the Pages preview hostname, the production hostname, and `http://localhost:5173` as allowed origins. Email/password, OAuth, and password-reset flows funnel through `/auth/callback`.

## Stripe and reminders

1. Create the monthly and yearly Pro prices and set their IDs as Pages secrets.
2. Point the Stripe webhook to `/billing/webhook/stripe` and use the endpoint signing secret.
3. Deploy the reminder worker with `npm run worker:deploy` after setting its Worker secrets in `workers/reminders/wrangler.toml` (email + VAPID keys for push) and confirming its Hyperdrive binding points at the same Neon database.

## Preview acceptance test

On a Pages preview deployment with Stripe test keys, create a user and motorcycle. Confirm that:

1. An image and a PDF receipt populate the fuel form after OCR and save an actual fuel record.
2. Saving fuel, maintenance, tire, or work records updates the motorcycle odometer.
3. A maintenance interval, document expiry, and annual fee each create one linked reminder and updating the source updates that reminder.
4. An uploaded receipt/document downloads only for its owner.
5. Checkout, portal access, and a signed Stripe webhook update the subscription profile.
6. Free-plan caps block a second active bike, a 4th upload, a 4th active reminder, and a 4th work session in the same month.
7. Conta export download and deletion confirmation (`EXCLUIR`) create LGPD requests; staff can fulfill them in Admin.
