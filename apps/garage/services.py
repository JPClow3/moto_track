from __future__ import annotations

from django.db import transaction
from django.db.models import Max

from apps.garage.models import Motorcycle


@transaction.atomic
def recompute_motorcycle_odometer(motorcycle_id: int) -> int:
    motorcycle = Motorcycle.objects.select_for_update().get(id=motorcycle_id)  # pylint: disable=no-member

    fuel_max = motorcycle.fuel_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
    maintenance_max = motorcycle.maintenance_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
    record_max = max(int(fuel_max or 0), int(maintenance_max or 0))

    override = int(motorcycle.odometer_override_km or 0)
    effective = max(record_max, override)

    motorcycle.set_current_odometer(effective)
    return effective
