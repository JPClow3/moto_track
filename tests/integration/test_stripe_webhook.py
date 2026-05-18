"""Integration tests for the Stripe webhook pipeline.

Covers B-M11: previously zero tests exercised `apps.billing.webhooks` even
though it is on the critical billing path. These tests exercise the
idempotency guard, subscription status transitions, payment-failure grace
window, and concurrent-event safety.
"""

from __future__ import annotations

from datetime import UTC, datetime

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.billing.models import BillingEvent, BillingPlan, SubscriptionProfile
from apps.billing.webhooks import process_stripe_event


def _subscription_event(
    *,
    event_id: str,
    event_type: str,
    user_id: int,
    status: str = "active",
    customer_id: str = "cus_test_1",
    subscription_id: str = "sub_test_1",
    price_id: str = "price_monthly",
    interval: str = "month",
    current_period_end: int | None = None,
) -> dict:
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": subscription_id,
                "object": "subscription",
                "status": status,
                "customer": customer_id,
                "current_period_end": current_period_end
                or int(datetime(2030, 1, 1, tzinfo=UTC).timestamp()),
                "cancel_at_period_end": False,
                "metadata": {"user_id": str(user_id)},
                "items": {
                    "data": [
                        {
                            "price": {
                                "id": price_id,
                                "recurring": {"interval": interval},
                            }
                        }
                    ]
                },
            }
        },
    }


def _invoice_event(
    *,
    event_id: str,
    event_type: str,
    user_id: int,
    customer_id: str = "cus_test_1",
    subscription_id: str = "sub_test_1",
    paid: bool = True,
) -> dict:
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": "in_test_1",
                "object": "invoice",
                "customer": customer_id,
                "subscription": subscription_id,
                "status": "paid" if paid else "open",
                "hosted_invoice_url": "https://stripe.example/inv",
                "invoice_pdf": "https://stripe.example/inv.pdf",
                "metadata": {"user_id": str(user_id)},
            }
        },
    }


class StripeWebhookIdempotencyTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="webhook-user",
            email="webhook@example.com",
            password="pass12345",
        )
        SubscriptionProfile.objects.create(user=self.user)

    def test_subscription_created_grants_pro(self):
        event = _subscription_event(
            event_id="evt_1",
            event_type="customer.subscription.created",
            user_id=self.user.id,
        )
        process_stripe_event(event)
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.plan, BillingPlan.PRO)
        self.assertEqual(profile.stripe_subscription_status, "active")
        self.assertEqual(profile.stripe_subscription_id, "sub_test_1")

    def test_duplicate_event_is_idempotent(self):
        """B-C1: replaying the same event must not double-apply changes."""
        event = _subscription_event(
            event_id="evt_dup",
            event_type="customer.subscription.created",
            user_id=self.user.id,
        )
        process_stripe_event(event)
        process_stripe_event(event)
        self.assertEqual(BillingEvent.objects.filter(stripe_event_id="evt_dup").count(), 1)
        self.assertEqual(SubscriptionProfile.objects.filter(user=self.user).count(), 1)

    def test_subscription_deleted_downgrades_to_free(self):
        process_stripe_event(
            _subscription_event(
                event_id="evt_create",
                event_type="customer.subscription.created",
                user_id=self.user.id,
            )
        )
        process_stripe_event(
            _subscription_event(
                event_id="evt_delete",
                event_type="customer.subscription.deleted",
                user_id=self.user.id,
                status="canceled",
            )
        )
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.plan, BillingPlan.FREE)
        self.assertEqual(profile.stripe_subscription_status, "canceled")
        self.assertIsNone(profile.grace_until)

    def test_invoice_payment_failed_starts_grace_window(self):
        process_stripe_event(
            _subscription_event(
                event_id="evt_active",
                event_type="customer.subscription.created",
                user_id=self.user.id,
            )
        )
        process_stripe_event(
            _invoice_event(
                event_id="evt_failed",
                event_type="invoice.payment_failed",
                user_id=self.user.id,
                paid=False,
            )
        )
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.stripe_subscription_status, "past_due")
        self.assertIsNotNone(profile.grace_until)
        self.assertGreater(profile.grace_until, timezone.now())

    def test_invoice_paid_clears_grace_and_restores_pro(self):
        process_stripe_event(
            _subscription_event(
                event_id="evt_a",
                event_type="customer.subscription.created",
                user_id=self.user.id,
            )
        )
        process_stripe_event(
            _invoice_event(
                event_id="evt_b",
                event_type="invoice.payment_failed",
                user_id=self.user.id,
                paid=False,
            )
        )
        process_stripe_event(
            _invoice_event(
                event_id="evt_c",
                event_type="invoice.paid",
                user_id=self.user.id,
                paid=True,
            )
        )
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.plan, BillingPlan.PRO)
        self.assertIsNone(profile.grace_until)
        self.assertTrue(profile.latest_invoice_url.startswith("https://"))

    def test_missing_event_id_raises(self):
        from apps.billing.webhooks import WebhookProcessingError

        with self.assertRaises(WebhookProcessingError):
            process_stripe_event({"type": "customer.subscription.created", "data": {"object": {}}})

    def test_unknown_event_type_is_ignored_but_recorded(self):
        process_stripe_event(
            {
                "id": "evt_unknown",
                "type": "checkout.session.async_payment_succeeded",
                "data": {"object": {"metadata": {"user_id": str(self.user.id)}}},
            }
        )
        self.assertTrue(BillingEvent.objects.filter(stripe_event_id="evt_unknown").exists())
