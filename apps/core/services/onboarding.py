from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.garage.services import apply_template_to_motorcycle, variant_observation_text
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.tires.models import TirePosition, TireRecord


def create_motorcycle_from_onboarding(data: dict, user, spec_payload: dict | None = None) -> tuple[Motorcycle, list[str]]:
    """Create a Motorcycle and optional initial records from validated onboarding form data.

    Returns (motorcycle, warnings).
    """
    template = data.get("template")
    now = timezone.now()

    motorcycle = Motorcycle.objects.create(
        owner=user,
        name=data["motorcycle_name"],
        brand=data["brand"],
        model=data["model"],
        year=data["year"],
        source_template=template,
        observations=variant_observation_text(data.get("template_variant", "")),
        odometer_override_km=data["current_odometer_km"],
        odometer_override_at=now,
        current_odometer_km=data["current_odometer_km"],
        current_odometer_updated_at=now,
        riding_profile=data.get("riding_profile") or "auto",
    )

    warnings = apply_template_to_motorcycle(
        motorcycle=motorcycle,
        owner=user,
        template=template,
        spec_payload=spec_payload or {},
    )

    if data.get("fuel_date") and data.get("fuel_odometer_km") is not None and data.get("fuel_liters") and data.get("fuel_total_price"):
        price_per_liter = (data["fuel_total_price"] / data["fuel_liters"]).quantize(Decimal("0.001"))
        FuelRecord.objects.create(
            motorcycle=motorcycle,
            date=data["fuel_date"],
            odometer_km=data["fuel_odometer_km"],
            liters=data["fuel_liters"],
            total_price=data["fuel_total_price"],
            price_per_liter=price_per_liter,
            tank_full=True,
        )

    if data.get("service_date") and data.get("service_odometer_km") is not None:
        MaintenanceRecord.objects.create(
            motorcycle=motorcycle,
            maintenance_type=MaintenanceType.REVIEW,
            date=data["service_date"],
            odometer_km=data["service_odometer_km"],
            cost=data.get("service_cost") or Decimal("0"),
            description="Serviço inicial registrado no onboarding.",
        )

    tire_odometer = data.get("tire_odometer_km")
    tire_installed = data.get("tire_installed_at")
    if tire_odometer is not None and tire_installed:
        for position, label in [(TirePosition.FRONT, data.get("front_tire")), (TirePosition.REAR, data.get("rear_tire"))]:
            if label:
                TireRecord.objects.create(
                    motorcycle=motorcycle,
                    position=position,
                    brand_model=label,
                    installed_at=tire_installed,
                    installed_odometer_km=tire_odometer,
                    cost=Decimal("0"),
                    wear_percent=0,
                    is_active=True,
                )

    return motorcycle, warnings
