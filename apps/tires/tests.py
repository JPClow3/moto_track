import math

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from apps.garage.models import Motorcycle
from apps.tires.forms import TireProductForm
from apps.tires.models import TirePosition, TirePressureRecord, TireProduct, TireRecord, TireType


class TireModelTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="tire-user", email="tire@example.com", password="pass12345")
        self.other_user = User.objects.create_user(
            username="other-user", email="other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(  # pylint: disable=no-member
            owner=self.user, name="Moto 1", brand="Honda", model="CB 300F", year=2024
        )
        self.product = TireProduct.objects.create(  # pylint: disable=no-member
            owner=self.user,
            manufacturer="Pirelli",
            model_name="Angel GT",
            tire_type=TireType.TOURING,
            max_speed_kmh=210,
        )
        TireProduct.objects.create(  # pylint: disable=no-member
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
        self.assertEqual(TireProduct.objects.filter(owner=self.user).count(), 1)  # pylint: disable=no-member
        self.assertEqual(TireProduct.objects.filter(owner=self.other_user).count(), 1)  # pylint: disable=no-member

    def test_tire_product_form_accepts_catalog_fields(self):
        form = TireProductForm(
            data={
                "manufacturer": "Metzeler",
                "model_name": "Roadtec",
                "tire_type": TireType.TOURING,
                "width_mm": 150,
                "aspect_ratio": 70,
                "rim_diameter_in": 17,
                "load_index": "69",
                "speed_rating": "W",
                "max_speed_kmh": 270,
                "price_0": "900.00",
                "price_1": "BRL",
                "notes": "Uso estrada",
            }
        )

        self.assertTrue(form.is_valid())

    def test_tire_record_clean_rejects_wear_over_100(self):
        record = TireRecord(
            motorcycle=self.motorcycle,
            position=TirePosition.FRONT,
            brand_model="Pirelli Angel GT",
            installed_at="2026-04-14",
            installed_odometer_km=10000,
            cost="500.00",
            wear_percent=101,
        )

        with self.assertRaises(ValidationError):
            record.full_clean()

    def test_tire_record_has_audit_timestamps(self):
        record = TireRecord.objects.create(  # pylint: disable=no-member
            motorcycle=self.motorcycle,
            position=TirePosition.FRONT,
            brand_model="Pirelli Angel GT",
            installed_at="2026-04-14",
            installed_odometer_km=10200,
            cost="500.00",
            wear_percent=10,
        )

        self.assertIsNotNone(record.created_at)
        self.assertIsNotNone(record.updated_at)

    def test_tire_record_updates_motorcycle_odometer(self):
        TireRecord.objects.create(  # pylint: disable=no-member
            motorcycle=self.motorcycle,
            position=TirePosition.FRONT,
            brand_model="Pirelli Angel GT",
            installed_at="2026-04-14",
            installed_odometer_km=15000,
            cost="500.00",
            wear_percent=10,
        )
        self.motorcycle.refresh_from_db()

        self.assertEqual(self.motorcycle.current_odometer_km, 15000)


class TireViewTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="tire-view-user", email="tire-view@example.com", password="pass12345"
        )
        self.other_user = User.objects.create_user(
            username="tire-view-other", email="tire-view-other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(  # pylint: disable=no-member
            owner=self.user, name="Moto 1", brand="Honda", model="CB 300F", year=2024
        )
        self.other_motorcycle = Motorcycle.objects.create(  # pylint: disable=no-member
            owner=self.other_user, name="Moto 2", brand="Yamaha", model="MT-03", year=2024
        )
        self.product = TireProduct.objects.create(  # pylint: disable=no-member
            owner=self.user, manufacturer="Pirelli", model_name="Angel GT", tire_type=TireType.TOURING
        )
        self.record = TireRecord.objects.create(  # pylint: disable=no-member
            motorcycle=self.motorcycle,
            tire_product=self.product,
            position=TirePosition.REAR,
            brand_model="Pirelli Angel GT",
            installed_at="2026-04-10",
            installed_odometer_km=10000,
            cost="650.00",
            wear_percent=20,
        )
        self.other_record = TireRecord.objects.create(  # pylint: disable=no-member
            motorcycle=self.other_motorcycle,
            position=TirePosition.FRONT,
            brand_model="Outro pneu",
            installed_at="2026-04-11",
            installed_odometer_km=12000,
            cost="550.00",
            wear_percent=10,
        )

    def test_list_view_is_owner_scoped(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("tires:list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Pirelli Angel GT")
        self.assertNotContains(response, "Outro pneu")

    def test_tire_telemetry_radius_and_circumference_stay_synchronized(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("tires:list"))
        rear = response.context["rear"]

        self.assertEqual(rear["radius"], 88)
        self.assertEqual(rear["circumference"], round(math.tau * rear["radius"], 2))
        self.assertContains(response, f'r="{rear["radius"]}"')

    def test_create_view_creates_tire_record(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("tires:create"),
            {
                "motorcycle": self.motorcycle.pk,
                "tire_product": self.product.pk,
                "position": TirePosition.FRONT,
                "brand_model": "Novo Pneu",
                "installed_at": "2026-04-14",
                "installed_odometer_km": 11000,
                "cost_0": "700.00",
                "cost_1": "BRL",
                "wear_percent": 5,
                "is_active": True,
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            TireRecord.objects.filter(
                motorcycle=self.motorcycle, brand_model="Novo Pneu"
            ).exists()  # pylint: disable=no-member
        )

    def test_update_view_denies_other_user_record(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("tires:update", args=[self.other_record.pk]))

        self.assertEqual(response.status_code, 404)

    def test_delete_view_removes_owned_record(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("tires:delete", args=[self.record.pk]))

        self.assertEqual(response.status_code, 302)
        self.assertFalse(TireRecord.objects.filter(pk=self.record.pk).exists())  # pylint: disable=no-member

    def test_pressure_create_creates_record(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("tires:pressure_create"),
            {
                "motorcycle": self.motorcycle.pk,
                "date": "2026-04-14",
                "psi_front": 32,
                "psi_rear": 36,
                "notes": "frio",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            TirePressureRecord.objects.filter(motorcycle=self.motorcycle, psi_front=32, psi_rear=36).exists()  # pylint: disable=no-member
        )

    def test_product_crud_is_owner_scoped(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("tires:product_create"),
            {
                "manufacturer": "Metzeler",
                "model_name": "Roadtec",
                "tire_type": TireType.TOURING,
                "width_mm": 150,
                "aspect_ratio": 70,
                "rim_diameter_in": 17,
                "price_0": "900.00",
                "price_1": "BRL",
            },
        )

        self.assertEqual(response.status_code, 302)
        product = TireProduct.objects.get(owner=self.user, manufacturer="Metzeler")

        response = self.client.post(
            reverse("tires:product_update", args=[product.pk]),
            {
                "manufacturer": "Metzeler",
                "model_name": "Roadtec 02",
                "tire_type": TireType.TOURING,
                "width_mm": 150,
                "aspect_ratio": 70,
                "rim_diameter_in": 17,
                "price_0": "950.00",
                "price_1": "BRL",
            },
        )
        self.assertEqual(response.status_code, 302)
        product.refresh_from_db()
        self.assertEqual(product.model_name, "Roadtec 02")

        response = self.client.post(reverse("tires:product_delete", args=[product.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(TireProduct.objects.filter(pk=product.pk).exists())
