"""Billing-related signals.

The only handler here invalidates the request-scoped Pro-access cache when a
SubscriptionProfile is mutated. Without this, code that creates / updates a
profile via the ORM (tests, custom flows, admin actions) and then immediately
re-checks `has_pro_access(user)` would see a stale cached value from the same
request. The webhook path and Stripe-portal views also call
`invalidate_pro_access_cache` explicitly, so this is defence-in-depth.
"""

from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .entitlements import invalidate_pro_access_cache
from .models import SubscriptionProfile


@receiver(post_save, sender=SubscriptionProfile)
def _invalidate_on_save(sender, instance, **_kwargs):  # pragma: no cover - exercised via tests
    invalidate_pro_access_cache(getattr(instance, "user", None))


@receiver(post_delete, sender=SubscriptionProfile)
def _invalidate_on_delete(sender, instance, **_kwargs):  # pragma: no cover - exercised via tests
    invalidate_pro_access_cache(getattr(instance, "user", None))
