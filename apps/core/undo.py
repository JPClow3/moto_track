from __future__ import annotations

import secrets
from datetime import timedelta

from django.apps import apps
from django.utils import timezone


SESSION_KEY = "undo_actions"


def create_undo_token(request, *, model_label: str, object_id: int, label: str) -> str:
    token = secrets.token_urlsafe(12)
    actions = request.session.get(SESSION_KEY, {})
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
    actions = request.session.get(SESSION_KEY, {})
    payload = actions.pop(token, None)
    request.session[SESSION_KEY] = actions
    if request.session.get("last_undo_token") == token:
        request.session.pop("last_undo_token", None)
    request.session.modified = True

    if not payload:
        return None, "Ação para desfazer não encontrada."

    expires_at = timezone.datetime.fromisoformat(payload["expires_at"])
    if timezone.is_naive(expires_at):
        expires_at = timezone.make_aware(expires_at)
    if expires_at < timezone.now():
        return None, "A ação para desfazer expirou."

    model = apps.get_model(payload["model"])
    return model.objects.filter(pk=payload["object_id"]).first(), ""
