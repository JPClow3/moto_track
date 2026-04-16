from __future__ import annotations

from apps.core.active_motorcycle import get_active_motorcycle
from apps.garage.models import Motorcycle
from apps.core.undo import SESSION_KEY as UNDO_SESSION_KEY


def garage_context(request):
    if not request.user.is_authenticated:
        return {}

    motorcycles = list(
        Motorcycle.objects.filter(owner=request.user, is_active=True).order_by("name")
    )  # pylint: disable=no-member
    active = get_active_motorcycle(request)
    undo_token = request.session.get("last_undo_token")
    undo_payload = request.session.get(UNDO_SESSION_KEY, {}).get(undo_token) if undo_token else None
    return {
        "garage_motorcycles": motorcycles,
        "active_motorcycle": active,
        "snackbar_undo": {"token": undo_token, **undo_payload} if undo_payload else None,
        "current_density": request.session.get("density", "comfortable"),
    }
