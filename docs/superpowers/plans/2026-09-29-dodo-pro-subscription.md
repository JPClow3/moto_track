# Dodo Payments Pro Subscription Implementation Plan

**Goal:** Move Moto Track Pro to Dodo Payments hosted recurring checkout,
signed subscription lifecycle events, and self-service billing while keeping
the current Free/Pro features and monthly/yearly presentation.

Use [the migration runbook](../../dodo-payments-migration.md) as the cutover
record. These items require evidence before release:

- [ ] Configure the two recurring BRL products and check hosted checkout totals.
- [ ] Configure preview and production runtime keys, product IDs, and signing secrets.
- [ ] Verify first-signup seven-day trial and returning-subscriber immediate billing.
- [ ] Verify checkout interval validation, ownership, and duplicate checkout prevention.
- [ ] Verify idempotent signed lifecycle events, cancellation, and payment recovery.
- [ ] Verify portal invoices and payment-method updates; allow cancellation only at the next billing date.
- [ ] Resolve existing billable subscription handover before database cutover.
- [ ] Run required checks and provider acceptance on the deployed preview.
- [ ] Verify production webhook delivery and retain sanitized cutover evidence.
