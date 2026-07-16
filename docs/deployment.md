# Cloudflare Deployment Checklist

Moto Track runs server-rendered SvelteKit routes on Cloudflare Pages. Runtime secrets must be configured on the Pages project because server routes read `event.platform.env`; build-time environment variables are not a substitute.

## Pages bindings

Configure the `R2_BUCKET` binding to the `moto-track-media` R2 bucket. Add these plaintext variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_SITE_URL`

Add these as encrypted secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `MISTRAL_API_KEY`

`MISTRAL_API_KEY` is server-only. Receipt image and PDF OCR fails clearly when it is absent; it never returns fabricated fuel values.

## Supabase

1. Run `npm run db:migrate` against the target project.
2. Run `npm run supabase:types` and commit any generated type changes.
3. Confirm RLS is enabled for every user-owned table.
4. Configure Supabase Auth redirect URLs for the Pages preview hostname, production hostname, and `http://localhost:5173`. All flows (magic link, OAuth, password recovery) funnel through `/auth/callback`, so only that path needs to be allow-listed per hostname (e.g. `https://moto-track.net/auth/callback`).
5. If using Supabase's OAuth 2.1 Server (Moto Track acting as an identity provider for third-party apps): under **Authentication → OAuth Server**, enable it and set **Authorization Path** to `/oauth/consent`. Register each OAuth client app under **Authentication → OAuth Apps** with its exact redirect URI(s) — no wildcards allowed there.

## Stripe and reminders

1. Create the monthly and yearly Pro prices and set their IDs as Pages secrets.
2. Point the Stripe webhook to `/billing/webhook/stripe` and use the endpoint signing secret.
3. Deploy the reminder worker with `npm run worker:deploy` after setting its four Worker secrets shown in `workers/reminders/wrangler.toml`.

## Preview acceptance test

On a Pages preview deployment with Stripe test keys, create a user and motorcycle. Confirm that:

1. An image and a PDF receipt populate the fuel form after OCR and save an actual fuel record.
2. Saving fuel, maintenance, tire, or work records updates the motorcycle odometer.
3. A maintenance interval, document expiry, and annual fee each create one linked reminder and updating the source updates that reminder.
4. An uploaded receipt/document downloads only for its owner.
5. Checkout, portal access, and a signed Stripe webhook update the subscription profile.
