from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord


class MotorcycleModelTests(TestCase):
	def setUp(self):
		User = get_user_model()
		self.user = User.objects.create_user(username="garage-user", email="garage@example.com", password="pass12345")
		self.motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023)

	def test_computed_odometer_uses_max_from_fuel_and_maintenance(self):
		FuelRecord.objects.create(
			motorcycle=self.motorcycle,
			date="2026-04-13",
			odometer_km=10000,
			liters=Decimal("9.000"),
			total_price=Decimal("63.00"),
			price_per_liter=Decimal("7.000"),
		)
		MaintenanceRecord.objects.create(
			motorcycle=self.motorcycle,
			date="2026-04-10",
			odometer_km=10500,
			cost=Decimal("120.00"),
		)

		self.assertEqual(self.motorcycle.computed_odometer_km, 10500)

	def test_current_odometer_prefers_override_when_higher(self):
		FuelRecord.objects.create(
			motorcycle=self.motorcycle,
			date="2026-04-13",
			odometer_km=10000,
			liters=Decimal("9.000"),
			total_price=Decimal("63.00"),
			price_per_liter=Decimal("7.000"),
		)
		self.motorcycle.odometer_override_km = 12000
		self.motorcycle.save(update_fields=["odometer_override_km"])

		self.assertEqual(self.motorcycle.current_odometer_km, 12000)
