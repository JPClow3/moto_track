from __future__ import annotations

from django.conf import settings


def email_verification_is_mandatory() -> bool:
    return str(getattr(settings, "ACCOUNT_EMAIL_VERIFICATION", "")).lower() == "mandatory"


def user_has_verified_email(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff or user.is_superuser:
        return True

    email_addresses = getattr(user, "emailaddress_set", None)
    if email_addresses is None:
        return False
    return email_addresses.filter(verified=True).exists()


def user_needs_email_verification(user) -> bool:
    if not email_verification_is_mandatory():
        return False
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff or user.is_superuser:
        return False
    return not user_has_verified_email(user)
