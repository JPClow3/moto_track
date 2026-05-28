"""Billing-related signals."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .entitlements import invalidate_pro_access_cache, is_admin_entitled, sync_admin_subscription_profile
from .models import SubscriptionProfile

User = get_user_model()


@receiver(post_save, sender=SubscriptionProfile)
def _invalidate_on_save(sender, instance, **_kwargs):  # pragma: no cover - exercised via tests
    user = getattr(instance, "user", None)
    invalidate_pro_access_cache(user)
    if is_admin_entitled(user):
        sync_admin_subscription_profile(user)


@receiver(post_delete, sender=SubscriptionProfile)
def _invalidate_on_delete(sender, instance, **_kwargs):  # pragma: no cover - exercised via tests
    invalidate_pro_access_cache(getattr(instance, "user", None))


@receiver(post_save, sender=User)
def _sync_admin_subscription_on_user_save(sender, instance, **_kwargs):  # pragma: no cover - exercised via tests
    invalidate_pro_access_cache(instance)
    if is_admin_entitled(instance):
        sync_admin_subscription_profile(instance)
