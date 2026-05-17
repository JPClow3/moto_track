# ADR 0002: Stripe webhook idempotency via `BillingEvent` ledger

- **Status**: Accepted
- **Date**: 2026-05-17 (retroactive seed)

## Context

Stripe retries webhook deliveries on any non-2xx response, and occasionally
delivers the same event more than once even on success. Without a dedup guard,
"subscription created" could grant Pro twice, "invoice payment failed" could
extend the grace window multiple times, etc.

## Decision

Every event Stripe sends is recorded in `apps.billing.models.BillingEvent` with
`stripe_event_id` as a unique key. `apps.billing.webhooks.process_stripe_event`:

1. Wraps everything in `@transaction.atomic`.
2. Does `BillingEvent.objects.get_or_create(stripe_event_id=…)` first.
3. If the event already has `processed_at`, returns early.
4. Looks up the affected `SubscriptionProfile` with `select_for_update()` so
   concurrent webhook workers cannot race on the same profile (B-M2).
5. Applies the change, sets `processed_at`, saves.

If the event is malformed we raise `WebhookProcessingError`, which the view
turns into a 400 (Stripe will retry).

## Consequences

- One DB row per Stripe event — bounded growth, easy auditing.
- Replays during incident response are safe (re-fire from the dashboard).
- The `select_for_update` lock means webhook throughput is gated by row-level
  Postgres locks. Acceptable: single subscription per user.

See `tests/integration/test_stripe_webhook.py` for the regression contract.
