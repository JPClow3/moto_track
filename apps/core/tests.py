from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle


class CoreViewsTests(TestCase):
	def setUp(self):
		User = get_user_model()
		self.user = User.objects.create_user(username="core-user", email="core@example.com", password="pass12345")
		self.motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023)
		FuelRecord.objects.create(
			motorcycle=self.motorcycle,
			date="2026-04-13",
			odometer_km=10000,
			liters=Decimal("9.000"),
			total_price=Decimal("63.00"),
			price_per_liter=Decimal("7.000"),
		)

	def test_dashboard_requires_login(self):
		response = self.client.get(reverse("dashboard"))
		self.assertEqual(response.status_code, 302)

	def test_dashboard_renders_for_authenticated_user(self):
		self.client.force_login(self.user)
		response = self.client.get(reverse("dashboard"))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Controle da sua moto em um só lugar")

	def test_odometer_quick_update_rejects_lower_value(self):
		self.client.force_login(self.user)
		response = self.client.post(
			reverse("quick_odometer_update"),
			{"odometer_override_km": 9000, "next": reverse("dashboard")},
		)

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "não pode ser menor")

	def test_odometer_quick_update_accepts_higher_value(self):
		self.client.force_login(self.user)
		response = self.client.post(
			reverse("quick_odometer_update"),
			{"odometer_override_km": 12000, "next": reverse("dashboard")},
		)

		self.assertEqual(response.status_code, 302)
		self.motorcycle.refresh_from_db()
		self.assertEqual(self.motorcycle.odometer_override_km, 12000)
