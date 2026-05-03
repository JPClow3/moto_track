from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle, MotorcycleTemplate, MotorcycleTemplateSpec
from apps.garage.services import apply_template_to_motorcycle
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.reminders.models import Reminder, TriggerType
from apps.reminders.services import evaluate_reminder
from apps.tires.models import TireRecord


class FuelOdometerReminderFlowTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="flow-user", email="flow@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Flow Moto",
            brand="Honda",
            model="CB",
            year=2024,
            current_odometer_km=5000,
        )
        self.reminder = Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Troca de oleo",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=5000,
            reference_km=0,
        )

    def test_fuel_record_increments_odometer_and_evaluates_reminder(self):
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 1),
            odometer_km=7500,
            liters=Decimal("10.000"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        self.motorcycle.refresh_from_db()
        self.assertEqual(self.motorcycle.current_odometer_km, 7500)

        eval_result = evaluate_reminder(self.reminder, current_odometer_km=7500, today=date(2026, 4, 1))
        self.assertEqual(eval_result.status, "overdue")
        self.assertEqual(eval_result.remaining_km, -2500)

    def test_fuel_record_below_current_does_not_raise_odometer(self):
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 1),
            odometer_km=3000,
            liters=Decimal("5.000"),
            total_price=Decimal("35.00"),
            price_per_liter=Decimal("7.000"),
        )
        self.motorcycle.refresh_from_db()
        self.assertEqual(self.motorcycle.current_odometer_km, 5000)


class OnboardingTemplateFlowTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="onboard-user", email="onboard@example.com", password="pass12345")
        self.template = MotorcycleTemplate.objects.create(
            brand="Yamaha",
            model="MT-03",
            year_from=2020,
            engine_cc=321,
        )
        MotorcycleTemplateSpec.objects.create(
            template=self.template,
            fuel_tank_capacity_l=Decimal("14.00"),
            oil_capacity_l=Decimal("1.80"),
            tire_size_front="110/70R17",
            tire_size_rear="140/70R17",
        )

    def test_onboarding_with_template_creates_motorcycle_spec_and_records(self):
        self.client.force_login(self.user)
        payload = {
            "motorcycle_name": "Minha MT",
            "brand": "Yamaha",
            "model": "MT-03",
            "year": 2022,
            "current_odometer_km": 12000,
            "template": str(self.template.pk),
        }
        response = self.client.post(reverse("onboarding"), payload)
        self.assertEqual(response.status_code, 302)

        motorcycle = Motorcycle.objects.get(owner=self.user, name="Minha MT")
        self.assertEqual(motorcycle.current_odometer_km, 12000)
        self.assertTrue(hasattr(motorcycle, "spec"))
        self.assertIsNotNone(motorcycle.spec)

        self.assertEqual(FuelRecord.objects.filter(motorcycle=motorcycle).count(), 0)
        self.assertEqual(MaintenanceRecord.objects.filter(motorcycle=motorcycle, maintenance_type=MaintenanceType.REVIEW).count(), 0)
        self.assertEqual(TireRecord.objects.filter(motorcycle=motorcycle).count(), 0)

    def test_apply_template_to_motorcycle_creates_maintenance_intervals(self):
        from apps.garage.models import MotorcycleTemplateMaintenanceInterval
        MotorcycleTemplateMaintenanceInterval.objects.create(
            template=self.template,
            maintenance_type="oil_change",
            interval_km=5000,
            interval_days=180,
        )
        motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Template Moto",
            brand="Yamaha",
            model="MT-03",
            year=2022,
        )
        apply_template_to_motorcycle(
            motorcycle=motorcycle,
            owner=self.user,
            template=self.template,
            spec_payload={},
        )
        from apps.maintenance.models import MaintenancePlanItem
        items = MaintenancePlanItem.objects.filter(motorcycle=motorcycle)
        self.assertTrue(items.filter(maintenance_type="oil_change").exists())
