from __future__ import annotations

import logging

from django.conf import settings
from django.db import OperationalError, ProgrammingError

from apps.accounts.models import UserPreference
from apps.accounts.verification import user_needs_email_verification
from apps.core.models import SiteSettings
from apps.core.undo import SESSION_KEY as UNDO_SESSION_KEY
from apps.garage.active_motorcycle import get_active_motorcycle
from apps.garage.models import Motorcycle

logger = logging.getLogger(__name__)


def site_settings_context(request):
    try:
        # get_cached() already caches the "no row yet" outcome, so calling
        # load() afterwards would issue a second pointless DB query. When
        # there is no row, fall back to an unsaved default so templates keep
        # their `|default` filters working without paying a query per request.
        settings_obj = SiteSettings.get_cached() or SiteSettings(pk=1)
        return {"site_settings": settings_obj, "app_build_id": getattr(settings, "APP_BUILD_ID", "dev")}
    except (OperationalError, ProgrammingError):
        logger.warning("SiteSettings table not available (migrations pending).")
        return {"site_settings": None, "app_build_id": getattr(settings, "APP_BUILD_ID", "dev")}


def garage_context(request):
    if not request.user.is_authenticated:
        return {"web_push_public_key": getattr(settings, "WEB_PUSH_PUBLIC_KEY", "")}

    user_theme_preference = "system"
    try:
        pref = request.user.preference
        user_theme_preference = pref.theme
    except UserPreference.DoesNotExist:
        pass

    if request.path.startswith("/api/") or request.headers.get("HX-Request") == "true":
        return {
            "current_density": request.session.get("density", "comfortable"),
            "web_push_public_key": getattr(settings, "WEB_PUSH_PUBLIC_KEY", ""),
            "user_theme_preference": user_theme_preference,
            "account_email_verified": not user_needs_email_verification(request.user),
        }

    motorcycles = list(
        Motorcycle.objects.filter(owner=request.user, is_active=True).select_related("owner").order_by("name")
    )  # pylint: disable=no-member

    # Cache active motorcycle on request to avoid redundant queries across context processors/views.
    active = getattr(request, "_cached_active_motorcycle", None)
    if active is None:
        active = get_active_motorcycle(request)
        request._cached_active_motorcycle = active

    undo_token = request.session.get("last_undo_token")
    undo_payload = request.session.get(UNDO_SESSION_KEY, {}).get(undo_token) if undo_token else None
    return {
        "garage_motorcycles": motorcycles,
        "active_motorcycle": active,
        "snackbar_undo": {"token": undo_token, **undo_payload} if undo_payload else None,
        "current_density": request.session.get("density", "comfortable"),
        "web_push_public_key": getattr(settings, "WEB_PUSH_PUBLIC_KEY", ""),
        "user_theme_preference": user_theme_preference,
        "account_email_verified": not user_needs_email_verification(request.user),
    }
