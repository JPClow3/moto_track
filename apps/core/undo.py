from __future__ import annotations

import secrets
from datetime import timedelta

from django.apps import apps
from django.utils import timezone
from django.utils.dateparse import parse_datetime

SESSION_KEY = "undo_actions"


def _parse_expires_at(value: str):
    expires_at = parse_datetime(value)
    if expires_at is None:
        raise ValueError("Formato de data inválido.")
    if timezone.is_naive(expires_at):
        expires_at = timezone.make_aware(expires_at)
    return expires_at


def _purge_expired_actions(actions: dict, *, now=None) -> dict:
    now = now or timezone.now()
    kept = {}
    for token, payload in actions.items():
        try:
            expires_at = _parse_expires_at(payload["expires_at"])
        except (KeyError, TypeError, ValueError):
            continue
        if expires_at >= now:
            kept[token] = payload
    return kept


def create_undo_token(request, *, model_label: str, object_id: int, label: str) -> str:
    token = secrets.token_urlsafe(12)
    actions = _purge_expired_actions(request.session.get(SESSION_KEY, {}))
    actions[token] = {
        "model": model_label,
        "object_id": int(object_id),
        "label": label,
        "expires_at": (timezone.now() + timedelta(minutes=10)).isoformat(),
    }
    request.session[SESSION_KEY] = actions
    request.session["last_undo_token"] = token
    request.session.modified = True
    return token


def consume_undo_token(request, *, token: str):
    actions = _purge_expired_actions(request.session.get(SESSION_KEY, {}))
    payload = actions.pop(token, None)
    request.session[SESSION_KEY] = actions
    if request.session.get("last_undo_token") == token:
        request.session.pop("last_undo_token", None)
    request.session.modified = True

    if not payload:
        return None, "Ação para desfazer não encontrada."

    expires_at = _parse_expires_at(payload["expires_at"])
    if expires_at < timezone.now():
        return None, "A ação para desfazer expirou."

    model = apps.get_model(payload["model"])
    return model.objects.filter(pk=payload["object_id"]).first(), ""
