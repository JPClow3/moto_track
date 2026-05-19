from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .entitlements import invalidate_pro_access_cache
from .models import BillingEvent, BillingInterval, BillingPlan, SubscriptionProfile

ACCESS_GRANTING_STATUSES = {"active", "trialing"}
TERMINAL_STATUSES = {"canceled", "incomplete_expired"}


class WebhookProcessingError(ValueError):
    pass


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


def _stripe_id(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("id", "") or "")
    nested_id = getattr(value, "id", None)
    if nested_id:
        return str(nested_id)
    return str(value or "")


def _subscription_status_from_invoice(invoice) -> str:
    subscription = _get(invoice, "subscription")
    if isinstance(subscription, dict):
        return str(subscription.get("status", "") or "")
    return str(getattr(subscription, "status", "") or "")


def _subscription_transition_status(status: str, profile: SubscriptionProfile) -> str:
    if status in ACCESS_GRANTING_STATUSES:
        return status
    if status in {"past_due"}:
        return "past_due"
    if status in TERMINAL_STATUSES:
        return status
    return profile.stripe_subscription_status


def _paid_invoice_status(invoice, profile: SubscriptionProfile) -> str:
    subscription_status = _subscription_status_from_invoice(invoice)
    if subscription_status:
        return subscription_status
    if profile.stripe_subscription_status == "trialing":
        return "trialing"
    if profile.stripe_subscription_status in ACCESS_GRANTING_STATUSES | {"past_due"}:
        return "active"
    return profile.stripe_subscription_status


def _timestamp(value):
    if not value:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.get_current_timezone())
    except (OverflowError, OSError, TypeError, ValueError) as exc:
        raise WebhookProcessingError("Invalid Stripe timestamp.") from exc


def _user_from_payload(obj) -> Any | None:
    metadata = _get(obj, "metadata", {}) or {}
    user_id = _get(metadata, "user_id")
    if user_id:
        User = get_user_model()
        return User.objects.filter(pk=user_id).first()
    return None


def _profile_for(obj) -> SubscriptionProfile | None:
    # B-M2: take a row-level lock on the SubscriptionProfile so that two
    # webhook events arriving for the same subscription cannot race each
    # other into inconsistent state (e.g. one writes `grace_until`, the other
    # writes `canceled`, last writer wins). All callers run inside the outer
    # `@transaction.atomic` wrapping `process_stripe_event`.
    raw_sub_id = _get(obj, "id") if str(_get(obj, "object", "")).lower() == "subscription" else _get(obj, "subscription")
    sub_id = _stripe_id(raw_sub_id)
    customer_id = _stripe_id(_get(obj, "customer"))
    query = SubscriptionProfile.objects.select_for_update()
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
        profile, _ = SubscriptionProfile.objects.select_for_update().get_or_create(user=user)
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
    profile.stripe_customer_id = _stripe_id(_get(subscription, "customer")) or profile.stripe_customer_id
    profile.stripe_subscription_id = _stripe_id(_get(subscription, "id")) or profile.stripe_subscription_id
    profile.stripe_subscription_status = _subscription_transition_status(status, profile)
    profile.stripe_price_id = price_id
    profile.billing_interval = billing_interval
    profile.current_period_end = _timestamp(_get(subscription, "current_period_end"))
    profile.cancel_at_period_end = bool(_get(subscription, "cancel_at_period_end", False))
    if status in ACCESS_GRANTING_STATUSES:
        profile.plan = BillingPlan.PRO
        profile.grace_until = None
    elif status in TERMINAL_STATUSES:
        profile.plan = BillingPlan.FREE
        profile.grace_until = None
    profile.save()
    # B-H9: drop the request-scoped pro-access cache so any subsequent
    # entitlement check in the same transaction reflects the new state.
    invalidate_pro_access_cache(profile.user)


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
    profile.stripe_customer_id = _stripe_id(_get(session, "customer")) or profile.stripe_customer_id
    profile.stripe_subscription_id = _stripe_id(_get(session, "subscription")) or profile.stripe_subscription_id
    profile.save(update_fields=["stripe_customer_id", "stripe_subscription_id", "updated_at"])
    invalidate_pro_access_cache(user)


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
        invoice_status = _paid_invoice_status(invoice, profile)
        if invoice_status in ACCESS_GRANTING_STATUSES:
            profile.plan = BillingPlan.PRO
            profile.stripe_subscription_status = invoice_status
            profile.grace_until = None
        profile.save()
        invalidate_pro_access_cache(profile.user)
    else:
        if profile.stripe_subscription_status in TERMINAL_STATUSES:
            # Already terminal - just save the invoice URLs captured above
            profile.save()
            invalidate_pro_access_cache(profile.user)
            return
        profile.stripe_subscription_status = "past_due"
        profile.grace_until = timezone.now() + timedelta(days=3)
        profile.save()
        invalidate_pro_access_cache(profile.user)


def _apply_trial_will_end(subscription) -> None:
    profile = _profile_for(subscription)
    if not profile:
        return
    profile.trial_will_end_notified_at = timezone.now()
    period_end = _timestamp(_get(subscription, "current_period_end"))
    if period_end:
        profile.current_period_end = period_end
    profile.save(update_fields=["trial_will_end_notified_at", "current_period_end", "updated_at"])
    invalidate_pro_access_cache(profile.user)


def _apply_invoice_upcoming(invoice) -> None:
    profile = _profile_for(invoice)
    if not profile:
        return
    next_at = _timestamp(_get(invoice, "next_payment_attempt")) or _timestamp(_get(invoice, "period_end"))
    amount_due = _get(invoice, "amount_due")
    currency = _get(invoice, "currency", "") or ""
    profile.next_invoice_at = next_at
    if isinstance(amount_due, int) and amount_due >= 0:
        profile.next_invoice_amount_cents = amount_due
    profile.next_invoice_currency = str(currency).upper()
    profile.save(update_fields=[
        "next_invoice_at",
        "next_invoice_amount_cents",
        "next_invoice_currency",
        "updated_at",
    ])


def _apply_customer_updated(customer) -> None:
    customer_id = _stripe_id(_get(customer, "id"))
    if not customer_id:
        return
    profile = SubscriptionProfile.objects.select_for_update().filter(stripe_customer_id=customer_id).first()
    if not profile:
        # No-op: customer not linked to a profile yet.
        return
    deleted = bool(_get(customer, "deleted", False))
    if deleted:
        profile.stripe_customer_id = ""
        profile.save(update_fields=["stripe_customer_id", "updated_at"])


@transaction.atomic
def process_stripe_event(event: dict[str, Any]) -> BillingEvent:
    event_id = str(_get(event, "id", "") or "")
    event_type = str(_get(event, "type", "") or "")
    if not event_id or not event_type:
        raise WebhookProcessingError("Stripe event is missing id or type.")
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
                invalidate_pro_access_cache(profile.user)
        elif event_type == "invoice.paid":
            _apply_invoice(obj, paid=True)
        elif event_type == "invoice.payment_failed":
            _apply_invoice(obj, paid=False)
        elif event_type == "customer.subscription.trial_will_end":
            _apply_trial_will_end(obj)
        elif event_type == "invoice.upcoming":
            _apply_invoice_upcoming(obj)
        elif event_type == "customer.updated":
            _apply_customer_updated(obj)
    except WebhookProcessingError as exc:
        billing_event.processing_error = str(exc)
        billing_event.save(update_fields=["processing_error", "updated_at"])
        raise

    billing_event.event_type = event_type
    billing_event.payload = _plain(event)
    billing_event.processed_at = timezone.now()
    billing_event.processing_error = ""
    billing_event.save(update_fields=["event_type", "payload", "processed_at", "processing_error", "updated_at"])
    return billing_event
