# Moto Track Feature Parity Checklist

Use this checklist when validating the SvelteKit product against the intended feature set.
The Django runtime has been removed from the final tree; do not expect Django template or media steps.

## Preserved Areas

- Landing, pricing, legal pages (`/privacidade`, `/lgpd`; `/politica` redirects), roadmap, PWA manifest, offline route, theme tokens + applicator.
- Auth routes backed by Supabase Auth, including Google OAuth and old `/accounts/*` redirects.
- App shell and protected routes for dashboard, garage, fuel, maintenance, tires, documents, reminders, expenses, reports, work, billing, admin.
- Owner-scoped Supabase tables with RLS policies for every user-owned model; privileged billing/staff columns locked down.
- Stripe checkout, portal, webhook event persistence, and payment-failure grace window.
- Free entitlements enforced for active bikes, uploads, reminders, and monthly work sessions.
- Public blog article list/detail.
- API v1 read/write endpoints (session or personal bearer token) for supported resources.
- R2 object access through authenticated server route.
- Reminder evaluation, odometer recomputation, fuel analytics, entitlements, and report summary domain modules.
- Supabase Edge Function for transactional email via Resend.
- Cloudflare scheduled Worker for reminder email/push processing.
- Legacy import script with deterministic UUIDv5 mapping (`scripts/import-legacy-data.ts`).

## Remaining Manual Checks

- Legal copy on `/privacidade` and `/lgpd` still needs a formal counsel review before launch marketing.
- Smoke an authenticated garage → checkout → Stripe webhook loop on a preview deployment (requires live Supabase + Stripe test keys).
- Confirm push subscriptions end-to-end after VAPID secrets are set on Pages and the reminder worker.
- If migrating historical data, run `LEGACY_EXPORT_PATH=legacy-export.json npm run import:legacy` and upload media keys to R2 from the generated manifest.
