from __future__ import annotations

from typing import Optional

from django.http import HttpRequest

from django.db.models import Max, Value
from django.db.models.functions import Greatest

from apps.garage.models import Motorcycle


SESSION_KEY = "active_motorcycle_id"


def get_active_motorcycle(request: HttpRequest) -> Optional[Motorcycle]:
	if not request.user.is_authenticated:
		return None

	base_qs = Motorcycle.objects.filter(owner=request.user).annotate(
		computed_odometer_km_value=Greatest(
			Max("fuel_records__odometer_km"),
			Max("maintenance_records__odometer_km"),
			Value(0),
		)
	)

	active_id = request.session.get(SESSION_KEY)
	if active_id:
		motorcycle = base_qs.filter(id=active_id).first()
		if motorcycle:
			return motorcycle

	motorcycle = base_qs.order_by("name").first()
	if motorcycle:
		request.session[SESSION_KEY] = motorcycle.id
	return motorcycle


def set_active_motorcycle(request: HttpRequest, motorcycle_id: int) -> Optional[Motorcycle]:
	if not request.user.is_authenticated:
		return None

	motorcycle = Motorcycle.objects.filter(owner=request.user, id=motorcycle_id).first()
	if motorcycle:
		request.session[SESSION_KEY] = motorcycle.id
		return motorcycle
	return None

