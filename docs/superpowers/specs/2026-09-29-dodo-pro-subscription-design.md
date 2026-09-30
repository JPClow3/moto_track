# Moto Track Pro Subscription Design

Moto Track Pro is a freemium web subscription with intended BRL base prices
of R$14.90 per month or R$99 per year. The pricing page reads configured Dodo
Payments products, keeps a native monthly/yearly selection form, and forwards
authenticated users to hosted checkout. Checkout confirms the total and
applicable taxes before authorization. Missing product configuration shows
a price-at-checkout fallback rather than an invented price.

The account view shows plan, cadence, next billing date, pending confirmation,
payment problems, and the Dodo Payments customer portal action. Signed
webhooks and canonical provider state are the source of truth for access.
A checkout return URL never grants Pro. The local schema uses
`billing_customer_id`, `billing_subscription_id`, and
`billing_subscription_status`; authenticated ownership is recorded before
checkout and checked before entitlement updates.

The first Pro subscription receives a seven-day free trial with a required
payment method; returning subscribers pay immediately. Dodo Payments marks a
trial subscription `active`, so the UI uses the persisted next billing date
instead of inventing a provider `trialing` status.

Configure the customer portal for invoice downloads, payment-method updates,
and cancellation at the next billing date. Disable immediate cancellation to
preserve access through the current period. Configure
`https://moto-track.net/billing/webhook/dodo` and save its signing secret as
`DODO_PAYMENTS_WEBHOOK_SECRET`. API key, webhook, and product IDs must share
the selected `DODO_PAYMENTS_ENVIRONMENT`. Actual provider provisioning and
deployment are release acceptance steps, not claims established by this document.
