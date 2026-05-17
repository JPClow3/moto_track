from __future__ import annotations

from django.http import HttpRequest

from apps.garage.models import Motorcycle

SESSION_KEY = "active_motorcycle_id"


def get_active_motorcycle(request: HttpRequest) -> Motorcycle | None:
    if not request.user.is_authenticated:
        return None

    base_qs = Motorcycle.objects.filter(owner=request.user, is_active=True)

    active_id = request.session.get(SESSION_KEY)
    if active_id:
        motorcycle = base_qs.filter(id=active_id).first()
        if motorcycle:
            return motorcycle

    motorcycle = base_qs.order_by("name").first()
    if motorcycle:
        request.session[SESSION_KEY] = motorcycle.id
    return motorcycle


def set_active_motorcycle(request: HttpRequest, motorcycle_id: int) -> Motorcycle | None:
    if not request.user.is_authenticated:
        return None

    motorcycle = Motorcycle.objects.filter(owner=request.user, id=motorcycle_id, is_active=True).first()
    if motorcycle:
        request.session[SESSION_KEY] = motorcycle.id
        return motorcycle
    return None
