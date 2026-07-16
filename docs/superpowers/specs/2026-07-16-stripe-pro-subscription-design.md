# Moto Track Pro Subscription Design

Moto Track Pro is a freemium web subscription with BRL recurring prices: R$14.90 per month or R$99 per year. The public pricing page uses a native monthly/yearly selection form and forwards authenticated users to Stripe-hosted Checkout in subscription mode.

The account view presents the persisted plan, billing cadence, checkout-pending state, payment problem state, and Stripe Customer Portal action. Stripe webhooks—not the return URL—are the source of truth for access. Checkout reuses the existing Stripe customer when possible and subscription lifecycle events upsert the local entitlement record idempotently.

The existing Customer Portal configuration already enables invoices, payment-method updates, and cancellation at the end of the current period. A production webhook endpoint must still be created in Stripe for `https://moto-track.net/billing/webhook/stripe`, then its signing secret must be saved as `STRIPE_WEBHOOK_SECRET` in Cloudflare Pages.
