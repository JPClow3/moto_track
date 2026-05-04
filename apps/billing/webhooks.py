from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import BillingEvent, BillingInterval, BillingPlan, SubscriptionProfile


def _plain(value: Any):
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, Decimal):
        return str(value)
    if hasattr(value, "to_dict_recursive"):
        return _plain(value.to_dict_recursive())
    if hasattr(value, "to_dict"):
        return _plain(value.to_dict())
    return str(value)


def _get(data: Any, key: str, default=None):
    if isinstance(data, dict):
        return data.get(key, default)
    return getattr(data, key, default)


def _timestamp(value):
    if not value:
        return None
    return datetime.fromtimestamp(int(value), tz=timezone.get_current_timezone())


def _user_from_payload(obj) -> Any | None:
    metadata = _get(obj, "metadata", {}) or {}
    user_id = _get(metadata, "user_id")
    if user_id:
        User = get_user_model()
        return User.objects.filter(pk=user_id).first()
    return None


def _profile_for(obj) -> SubscriptionProfile | None:
    sub_id = _get(obj, "id") if str(_get(obj, "object", "")).lower() == "subscription" else _get(obj, "subscription")
    customer_id = _get(obj, "customer")
    query = SubscriptionProfile.objects.all()
    if sub_id:
        profile = query.filter(stripe_subscription_id=sub_id).first()
        if profile:
            return profile
    if customer_id:
        profile = query.filter(stripe_customer_id=customer_id).first()
        if profile:
            return profile
    user = _user_from_payload(obj)
    if user:
        profile, _ = SubscriptionProfile.objects.get_or_create(user=user)
        return profile
    return None


def _subscription_price(subscription) -> tuple[str, str]:
    items = _get(subscription, "items", {}) or {}
    data = _get(items, "data", []) or []
    if not data:
        return "", ""
    price = _get(data[0], "price", {}) or {}
    recurring = _get(price, "recurring", {}) or {}
    interval = _get(recurring, "interval", "")
    billing_interval = BillingInterval.YEARLY if interval == "year" else BillingInterval.MONTHLY
    return _get(price, "id", "") or "", billing_interval


def _apply_subscription(subscription) -> None:
    profile = _profile_for(subscription)
    if not profile:
        return
    price_id, billing_interval = _subscription_price(subscription)
    status = _get(subscription, "status", "") or ""
    profile.stripe_customer_id = _get(subscription, "customer", "") or profile.stripe_customer_id
    profile.stripe_subscription_id = _get(subscription, "id", "") or profile.stripe_subscription_id
    profile.stripe_subscription_status = status
    profile.stripe_price_id = price_id
    profile.billing_interval = billing_interval
    profile.current_period_end = _timestamp(_get(subscription, "current_period_end"))
    profile.cancel_at_period_end = bool(_get(subscription, "cancel_at_period_end", False))
    if status == "active":
        profile.plan = BillingPlan.PRO
        profile.grace_until = None
    elif status in {"canceled", "incomplete_expired"}:
        profile.plan = BillingPlan.FREE
        profile.grace_until = None
    profile.save()


def _apply_checkout_session(session) -> None:
    user = _user_from_payload(session)
    if not user:
        ref = _get(session, "client_reference_id")
        if ref:
            User = get_user_model()
            user = User.objects.filter(pk=ref).first()
    if not user:
        return
    profile, _ = SubscriptionProfile.objects.get_or_create(user=user)
    profile.stripe_customer_id = _get(session, "customer", "") or profile.stripe_customer_id
    profile.stripe_subscription_id = _get(session, "subscription", "") or profile.stripe_subscription_id
    profile.save(update_fields=["stripe_customer_id", "stripe_subscription_id", "updated_at"])


def _apply_invoice(invoice, *, paid: bool) -> None:
    if not _get(invoice, "subscription"):
        return
    profile = _profile_for(invoice)
    if not profile:
        return
    if _get(invoice, "hosted_invoice_url"):
        profile.latest_invoice_url = _get(invoice, "hosted_invoice_url")
    if _get(invoice, "invoice_pdf"):
        profile.latest_receipt_url = _get(invoice, "invoice_pdf")
    if paid:
        profile.plan = BillingPlan.PRO
        profile.stripe_subscription_status = "active"
        profile.grace_until = None
        profile.save()
    else:
        profile.stripe_subscription_status = "past_due"
        profile.grace_until = timezone.now() + timedelta(days=3)
        profile.save()


@transaction.atomic
def process_stripe_event(event: dict[str, Any]) -> BillingEvent:
    event_id = str(_get(event, "id", ""))
    event_type = str(_get(event, "type", ""))
    billing_event, created = BillingEvent.objects.get_or_create(
        stripe_event_id=event_id,
        defaults={"event_type": event_type, "payload": _plain(event)},
    )
    if not created and billing_event.processed_at:
        return billing_event

    obj = _get(_get(event, "data", {}) or {}, "object", {}) or {}
    try:
        if event_type == "checkout.session.completed":
            _apply_checkout_session(obj)
        elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
            _apply_subscription(obj)
        elif event_type == "customer.subscription.deleted":
            profile = _profile_for(obj)
            if profile:
                profile.plan = BillingPlan.FREE
                profile.stripe_subscription_status = "canceled"
                profile.grace_until = None
                profile.cancel_at_period_end = False
                profile.save()
        elif event_type == "invoice.paid":
            _apply_invoice(obj, paid=True)
        elif event_type == "invoice.payment_failed":
            _apply_invoice(obj, paid=False)
    except Exception as exc:  # noqa: BLE001
        billing_event.processing_error = str(exc)
        billing_event.save(update_fields=["processing_error", "updated_at"])
        raise

    billing_event.event_type = event_type
    billing_event.payload = _plain(event)
    billing_event.processed_at = timezone.now()
    billing_event.processing_error = ""
    billing_event.save(update_fields=["event_type", "payload", "processed_at", "processing_error", "updated_at"])
    return billing_event
