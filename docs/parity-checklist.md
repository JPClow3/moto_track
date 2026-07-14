# Moto Track Feature Parity Checklist

Use this checklist against the last Django commit/history when validating parity.
The Django runtime has been removed from the final tree.

## Preserved Areas

- Landing, pricing, legal pages, roadmap, PWA manifest, offline route, dark-ready tokens.
- Auth routes backed by Supabase Auth, including Google OAuth and old `/accounts/*` redirects.
- App shell and protected routes for dashboard, garage, fuel, maintenance, tires, documents, reminders, expenses, reports, work, billing, admin.
- Owner-scoped Supabase tables with RLS policies for every user-owned model.
- Stripe checkout, portal, and webhook event persistence.
- Public blog article list/detail.
- API v1 read endpoints for fuel, maintenance, tire, reminders, documents, and expenses.
- R2 object access through authenticated server route.
- Reminder evaluation, odometer recomputation, fuel analytics, entitlements, and report summary domain modules.
- Supabase Edge Function for transactional email via Resend.
- Cloudflare scheduled Worker for reminder email processing.
- Legacy import script with deterministic UUIDv5 mapping.

## Remaining Manual Checks

- Compare each legacy template with the matching SvelteKit route for content density and form fields.
- Export local Django data to `legacy-export.json` before running `LEGACY_EXPORT_PATH=legacy-export.json npm run import:legacy`.
- Upload legacy media to R2 and update `object_files`/file key columns using the generated manifest.
- Replace short legal placeholder text with reviewed production copy.
