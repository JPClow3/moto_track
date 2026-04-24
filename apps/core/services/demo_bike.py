from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.fuel.models import FuelRecord, FuelType
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.reminders.models import Reminder, TriggerType
from apps.tires.models import TirePosition, TireRecord


def create_demo_motorcycle(user) -> Motorcycle:
    """Create a pre-populated demo motorcycle so new users can explore immediately."""
    now = timezone.now()
    today = now.date()

    with transaction.atomic():
        motorcycle = Motorcycle.objects.create(
            owner=user,
            name="Moto Demo",
            brand="Honda",
            model="CB 300F",
            year=2024,
            odometer_override_km=8500,
            odometer_override_at=now,
            current_odometer_km=8500,
            current_odometer_updated_at=now,
            riding_profile="mixed",
        )

        # Fuel records: realistic progression over ~3 months
        fuel_data = [
            (today - timedelta(days=75), 1200, Decimal("10.50"), Decimal("73.50"), True),
            (today - timedelta(days=60), 2400, Decimal("11.00"), Decimal("77.00"), False),
            (today - timedelta(days=55), 3600, Decimal("12.00"), Decimal("84.00"), True),
            (today - timedelta(days=40), 4800, Decimal("10.80"), Decimal("75.60"), True),
            (today - timedelta(days=28), 6000, Decimal("11.20"), Decimal("78.40"), False),
            (today - timedelta(days=20), 7200, Decimal("12.50"), Decimal("87.50"), True),
            (today - timedelta(days=10), 8000, Decimal("10.00"), Decimal("70.00"), True),
        ]

        for dt, odo, liters, total, full in fuel_data:
            price_per_liter = (total / liters).quantize(Decimal("0.001")) if liters else Decimal("0")
            FuelRecord.objects.create(
                motorcycle=motorcycle,
                date=dt,
                odometer_km=odo,
                liters=liters,
                total_price=total,
                price_per_liter=price_per_liter,
                fuel_type=FuelType.GASOLINE,
                tank_full=full,
                station_name="Posto Demo",
            )

        # Maintenance records
        MaintenanceRecord.objects.create(
            motorcycle=motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            date=today - timedelta(days=60),
            odometer_km=2400,
            cost=Decimal("120.00"),
            interval_km=3000,
            interval_days=180,
            description="Troca de óleo inicial na concessionária.",
        )
        MaintenanceRecord.objects.create(
            motorcycle=motorcycle,
            maintenance_type=MaintenanceType.CHAIN_SET,
            date=today - timedelta(days=30),
            odometer_km=6500,
            cost=Decimal("80.00"),
            interval_km=5000,
            interval_days=365,
            description="Lubrificação e ajuste da relação.",
        )
        MaintenanceRecord.objects.create(
            motorcycle=motorcycle,
            maintenance_type=MaintenanceType.REVIEW,
            date=today - timedelta(days=10),
            odometer_km=8000,
            cost=Decimal("0.00"),
            description="Revisão rápida de rotina.",
        )

        # Tire records
        TireRecord.objects.create(
            motorcycle=motorcycle,
            position=TirePosition.FRONT,
            brand_model="Michelin Pilot Street 2",
            installed_at=today - timedelta(days=90),
            installed_odometer_km=0,
            cost=Decimal("350.00"),
            wear_percent=15,
            is_active=True,
        )
        TireRecord.objects.create(
            motorcycle=motorcycle,
            position=TirePosition.REAR,
            brand_model="Michelin Pilot Street 2",
            installed_at=today - timedelta(days=90),
            installed_odometer_km=0,
            cost=Decimal("420.00"),
            wear_percent=35,
            is_active=True,
        )

        # Reminders
        Reminder.objects.create(
            motorcycle=motorcycle,
            title="Próxima troca de óleo",
            trigger_type=TriggerType.BY_INTERVAL,
            trigger_value_km=3000,
            trigger_value_days=180,
            reference_km=2400,
            reference_date=today - timedelta(days=60),
        )
        Reminder.objects.create(
            motorcycle=motorcycle,
            title="Revisão dos 10.000 km",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=10000,
            reference_km=0,
        )

        return motorcycle
