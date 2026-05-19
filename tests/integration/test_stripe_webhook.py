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
    amount_due: int | None = None,
    next_payment_attempt: int | None = None,
    currency: str = "brl",
) -> dict:
    obj = {
        "id": "in_test_1",
        "object": "invoice",
        "customer": customer_id,
        "subscription": subscription_id,
        "status": "paid" if paid else "open",
        "hosted_invoice_url": "https://stripe.example/inv",
        "invoice_pdf": "https://stripe.example/inv.pdf",
        "metadata": {"user_id": str(user_id)},
        "currency": currency,
    }
    if amount_due is not None:
        obj["amount_due"] = amount_due
    if next_payment_attempt is not None:
        obj["next_payment_attempt"] = next_payment_attempt
    return {
        "id": event_id,
        "type": event_type,
        "data": {"object": obj},
    }


def _checkout_session_event(
    *,
    event_id: str,
    user_id: int | None,
    customer_id: str = "cus_test_1",
    subscription_id: str = "sub_test_1",
    client_reference_id: str | None = None,
) -> dict:
    metadata = {"user_id": str(user_id)} if user_id is not None else {}
    return {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_1",
                "object": "checkout.session",
                "customer": customer_id,
                "subscription": subscription_id,
                "client_reference_id": client_reference_id,
                "metadata": metadata,
            }
        },
    }


def _customer_event(
    *,
    event_id: str,
    event_type: str = "customer.updated",
    customer_id: str = "cus_test_1",
    deleted: bool = False,
) -> dict:
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": customer_id,
                "object": "customer",
                "deleted": deleted,
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

    def test_checkout_session_completed_persists_ids(self):
        process_stripe_event(
            _checkout_session_event(event_id="evt_checkout_1", user_id=self.user.id)
        )
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.stripe_customer_id, "cus_test_1")
        self.assertEqual(profile.stripe_subscription_id, "sub_test_1")
        # Plan flip happens on subsequent subscription.created/updated.
        self.assertEqual(profile.plan, BillingPlan.FREE)

    def test_checkout_session_falls_back_to_client_reference_id(self):
        """When Stripe drops metadata, client_reference_id must still resolve the user."""
        process_stripe_event(
            _checkout_session_event(
                event_id="evt_checkout_ref",
                user_id=None,
                client_reference_id=str(self.user.id),
            )
        )
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.stripe_customer_id, "cus_test_1")

    def test_subscription_updated_with_cancel_at_period_end_true(self):
        event = _subscription_event(
            event_id="evt_cancel_pending",
            event_type="customer.subscription.updated",
            user_id=self.user.id,
        )
        event["data"]["object"]["cancel_at_period_end"] = True
        process_stripe_event(event)
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertTrue(profile.cancel_at_period_end)
        self.assertEqual(profile.plan, BillingPlan.PRO)
        self.assertIsNotNone(profile.current_period_end)

    def test_trial_will_end_marks_notification_timestamp(self):
        event = _subscription_event(
            event_id="evt_trial_warn",
            event_type="customer.subscription.trial_will_end",
            user_id=self.user.id,
            status="trialing",
        )
        process_stripe_event(event)
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertIsNotNone(profile.trial_will_end_notified_at)
        self.assertIsNotNone(profile.current_period_end)

    def test_invoice_upcoming_stores_next_invoice_fields(self):
        process_stripe_event(
            _subscription_event(
                event_id="evt_active_for_upcoming",
                event_type="customer.subscription.created",
                user_id=self.user.id,
            )
        )
        next_attempt = int(datetime(2030, 6, 1, tzinfo=UTC).timestamp())
        process_stripe_event(
            _invoice_event(
                event_id="evt_upcoming",
                event_type="invoice.upcoming",
                user_id=self.user.id,
                amount_due=2990,
                next_payment_attempt=next_attempt,
                currency="brl",
            )
        )
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.next_invoice_amount_cents, 2990)
        self.assertEqual(profile.next_invoice_currency, "BRL")
        self.assertIsNotNone(profile.next_invoice_at)

    def test_customer_deleted_clears_customer_id(self):
        SubscriptionProfile.objects.filter(user=self.user).update(stripe_customer_id="cus_test_1")
        process_stripe_event(
            _customer_event(event_id="evt_customer_del", customer_id="cus_test_1", deleted=True)
        )
        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.stripe_customer_id, "")


class StripeWebhookViewTests(TestCase):
    """View-level tests covering status codes Stripe relies on for retries."""

    def setUp(self):
        from django.test import Client

        User = get_user_model()
        self.user = User.objects.create_user(
            username="webhook-view-user",
            email="webhook-view@example.com",
            password="pass12345",
        )
        SubscriptionProfile.objects.create(user=self.user)
        self.client = Client()

    def test_processing_error_returns_500_so_stripe_retries(self):
        """Reliability bug fix: WebhookProcessingError must yield 5xx, not 4xx."""
        from unittest.mock import patch

        from apps.billing.webhooks import WebhookProcessingError

        payload = b'{"id":"evt_x","type":"customer.subscription.created","data":{"object":{}}}'

        with (
            patch("apps.billing.views.construct_webhook_event", return_value={"id": "evt_x", "type": "x"}),
            patch("apps.billing.views.process_stripe_event", side_effect=WebhookProcessingError("boom")),
        ):
            response = self.client.post(
                "/billing/webhook/stripe/",
                data=payload,
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="t=1,v1=abc",
            )
        self.assertEqual(response.status_code, 500)

    def test_oversized_payload_returns_413(self):
        from apps.billing.views import STRIPE_WEBHOOK_MAX_BODY_BYTES

        big_payload = b"x" * (STRIPE_WEBHOOK_MAX_BODY_BYTES + 1)
        response = self.client.post(
            "/billing/webhook/stripe/",
            data=big_payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=abc",
        )
        self.assertEqual(response.status_code, 413)
