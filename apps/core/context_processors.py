from __future__ import annotations

from apps.core.active_motorcycle import get_active_motorcycle
from apps.garage.models import Motorcycle


def garage_context(request):
    if not request.user.is_authenticated:
        return {}

    motorcycles = list(Motorcycle.objects.filter(owner=request.user).order_by("name"))  # pylint: disable=no-member
    active = get_active_motorcycle(request)
    return {
        "garage_motorcycles": motorcycles,
        "active_motorcycle": active,
    }

