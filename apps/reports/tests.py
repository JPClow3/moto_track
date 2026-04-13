from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord


class ReportOverviewTests(TestCase):
	def setUp(self):
		User = get_user_model()
		self.user = User.objects.create_user(username="report-user", email="report@example.com", password="pass12345")
		self.other_user = User.objects.create_user(username="other-user", email="other@example.com", password="pass12345")
		self.motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023)
		self.other_motorcycle = Motorcycle.objects.create(owner=self.other_user, name="Moto B", brand="Yamaha", model="MT", year=2024)

		FuelRecord.objects.create(
			motorcycle=self.motorcycle,
			date="2026-04-13",
			odometer_km=10000,
			liters=Decimal("10.000"),
			total_price=Decimal("70.00"),
			price_per_liter=Decimal("7.000"),
		)
		MaintenanceRecord.objects.create(
			motorcycle=self.motorcycle,
			date="2026-04-10",
			odometer_km=9800,
			cost=Decimal("150.00"),
		)

		FuelRecord.objects.create(
			motorcycle=self.other_motorcycle,
			date="2026-04-12",
			odometer_km=5000,
			liters=Decimal("8.000"),
			total_price=Decimal("50.00"),
			price_per_liter=Decimal("6.250"),
		)

	def test_report_overview_requires_login(self):
		response = self.client.get(reverse("reports:overview"))
		self.assertEqual(response.status_code, 302)

	def test_report_overview_returns_owner_aggregates(self):
		self.client.force_login(self.user)
		response = self.client.get(reverse("reports:overview"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.context["fuel_total"], Decimal("70"))
		self.assertEqual(response.context["maintenance_total"], Decimal("150"))
		self.assertEqual(response.context["fuel_records_count"], 1)
		self.assertEqual(response.context["maintenance_records_count"], 1)
		self.assertAlmostEqual(float(response.context["avg_odometer_km"]), 10000.0)
