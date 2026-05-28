from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PushDeliveryResult:
    delivered: bool = False
    expired: bool = False
    disabled: bool = False


def _vapid_subject() -> str:
    contact = (getattr(settings, "WEB_PUSH_CONTACT_EMAIL", "") or "").strip()
    if not contact:
        contact = (getattr(settings, "DEFAULT_FROM_EMAIL", "") or "no-reply@moto-track.local").strip()
    if contact.startswith(("mailto:", "https://", "http://")):
        return contact
    return f"mailto:{contact}"


def send_push(subscription, payload: dict) -> PushDeliveryResult:
    private_key = (getattr(settings, "WEB_PUSH_PRIVATE_KEY", "") or "").strip()
    if not private_key:
        return PushDeliveryResult(disabled=True)

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush is not installed; push reminder delivery disabled.")
        return PushDeliveryResult(disabled=True)

    subscription_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=private_key,
            vapid_claims={"sub": _vapid_subject()},
            ttl=60 * 60 * 24,
        )
    except WebPushException as exc:
        response = getattr(exc, "response", None)
        status_code = getattr(response, "status_code", None)
        if status_code in {404, 410}:
            subscription.delete()
            return PushDeliveryResult(expired=True)
        logger.exception("Failed to deliver push notification.")
        return PushDeliveryResult()
    except Exception:
        logger.exception("Failed to deliver push notification.")
        return PushDeliveryResult()
    return PushDeliveryResult(delivered=True)
