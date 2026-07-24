# Moto Track Feature Parity Checklist

Use this checklist when validating the SvelteKit product against the intended feature set.
The Django runtime has been removed from the final tree; do not expect Django template or media steps.

## Preserved Areas

- Landing, pricing, legal pages (`/privacidade`, `/lgpd`; `/politica` redirects), roadmap, PWA manifest, offline route, theme tokens + applicator.
- Auth routes backed by Neon Auth (managed Better Auth), including Google OAuth and old `/accounts/*` redirects.
- App shell and protected routes for dashboard, garage, fuel, maintenance, tires, documents, reminders, expenses, reports, work, billing, admin.
- Owner-scoped Neon tables, every query filtered by `owner_id` in the app layer (no RLS on Neon); privileged billing/staff columns have no user-facing write path.
- Stripe checkout, portal, webhook event persistence, and payment-failure grace window.
- Free entitlements enforced for active bikes, uploads, reminders, and monthly work sessions (app-layer guards plus matching database triggers).
- Public blog article list/detail.
- API v1 read/write endpoints (session or personal bearer token) for supported resources.
- R2 object access through authenticated server route.
- Reminder evaluation, odometer recomputation, fuel analytics, entitlements, and report summary domain modules.
- In-process transactional email via Resend (no Edge Function hop).
- Cloudflare scheduled Worker for reminder email/push processing.
- Legacy import script with deterministic UUIDv5 mapping (`scripts/import-legacy-data.ts`).

## Remaining Manual Checks

- Legal copy on `/privacidade` and `/lgpd` still needs a formal counsel review before launch marketing.
- Smoke an authenticated garage → checkout → Stripe webhook loop on a preview deployment (requires live Neon + Stripe test keys).
- Confirm push delivery end-to-end after VAPID + `PUSH_ENCRYPTION_KEY` secrets are set on Pages and the reminder worker.
- If migrating historical data, run `LEGACY_EXPORT_PATH=legacy-export.json npm run import:legacy` and upload media keys to R2 from the generated manifest.
