from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

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


class GarageViewTests(TestCase):
	def setUp(self):
		User = get_user_model()
		self.user = User.objects.create_user(username="garage-view-user", email="garage-view@example.com", password="pass12345")
		self.other_user = User.objects.create_user(username="garage-view-other", email="garage-view-other@example.com", password="pass12345")
		self.motorcycle = Motorcycle.objects.create(
			owner=self.user,
			name="Minha Moto",
			brand="Honda",
			model="CB 500",
			year=2022,
		)
		self.other_motorcycle = Motorcycle.objects.create(
			owner=self.other_user,
			name="Moto de outro",
			brand="Yamaha",
			model="MT-03",
			year=2021,
		)

	def test_list_view_only_shows_owned_motorcycles(self):
		self.client.force_login(self.user)
		response = self.client.get(reverse("garage:list"))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Minha Moto")
		self.assertNotContains(response, "Moto de outro")

	def test_create_view_persists_owner(self):
		self.client.force_login(self.user)
		response = self.client.post(
			reverse("garage:create"),
			{
				"name": "Nova Moto",
				"brand": "Suzuki",
				"model": "GSX-S750",
				"year": 2020,
				"license_plate": "ABC1D23",
			},
		)

		self.assertEqual(response.status_code, 302)
		created = Motorcycle.objects.get(name="Nova Moto")
		self.assertEqual(created.owner, self.user)

	def test_update_view_denies_access_to_other_user_motorcycle(self):
		self.client.force_login(self.user)
		response = self.client.get(reverse("garage:update", args=[self.other_motorcycle.pk]))

		self.assertEqual(response.status_code, 404)

	def test_delete_view_removes_only_owned_motorcycle(self):
		self.client.force_login(self.user)
		response = self.client.post(reverse("garage:delete", args=[self.motorcycle.pk]))

		self.assertEqual(response.status_code, 302)
		self.assertFalse(Motorcycle.objects.filter(pk=self.motorcycle.pk).exists())
		self.assertTrue(Motorcycle.objects.filter(pk=self.other_motorcycle.pk).exists())
