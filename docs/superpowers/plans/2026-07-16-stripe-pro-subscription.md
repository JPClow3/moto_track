# Stripe Pro Subscription Implementation Plan

**Goal:** Add hosted recurring checkout, reliable entitlement persistence, and self-service billing for Moto Track Pro.

- [x] Create active recurring Prices for the existing Moto-Track + product.
- [x] Set the production Price-ID secrets.
- [x] Validate checkout intervals and prevent duplicate entitled checkouts.
- [x] Persist checkout ownership and subscription lifecycle events idempotently.
- [x] Show pricing selection and account subscription states.
- [x] Cover billing mapping and annual selection with automated tests.
- [ ] Create and verify the production Stripe webhook destination, then save its signing secret in Cloudflare Pages.
