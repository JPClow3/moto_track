from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.garage.models import Motorcycle
from apps.tires.models import TireProduct, TireType


class TireModelTests(TestCase):
	def setUp(self):
		User = get_user_model()
		self.user = User.objects.create_user(username="tire-user", email="tire@example.com", password="pass12345")
		self.other_user = User.objects.create_user(username="other-user", email="other@example.com", password="pass12345")
		self.motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto 1", brand="Honda", model="CB 300F", year=2024)
		self.product = TireProduct.objects.create(
			owner=self.user,
			manufacturer="Pirelli",
			model_name="Angel GT",
			tire_type=TireType.TOURING,
			max_speed_kmh=210,
		)
		TireProduct.objects.create(
			owner=self.other_user,
			manufacturer="Michelin",
			model_name="Pilot Street",
			tire_type=TireType.SPORT,
		)

	def test_catalog_view_only_shows_owned_products(self):
		self.client.force_login(self.user)
		response = self.client.get(reverse("tires:catalogs"))

		self.assertContains(response, "Pirelli")
		self.assertNotContains(response, "Michelin")

	def test_owner_scoped_products_are_usable_in_queryset(self):
		self.assertEqual(TireProduct.objects.filter(owner=self.user).count(), 1)
		self.assertEqual(TireProduct.objects.filter(owner=self.other_user).count(), 1)
