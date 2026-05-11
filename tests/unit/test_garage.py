from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from apps.billing.models import BillingPlan, SubscriptionProfile
from apps.fuel.models import FuelRecord
from apps.garage.models import (
    Motorcycle,
    MotorcycleSpec,
    MotorcycleTemplate,
    MotorcycleTemplateMaintenanceInterval,
    MotorcycleTemplateRecommendedPart,
    MotorcycleTemplateSpec,
)
from apps.maintenance.models import MaintenanceRecord


class MotorcycleModelTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="garage-user", email="garage@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023
        )

    def test_current_odometer_is_denormalized_and_tracks_max(self):
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
            date="2026-04-14",
            odometer_km=10500,
            cost=Decimal("120.00"),
        )

        self.motorcycle.refresh_from_db()
        self.assertEqual(self.motorcycle.current_odometer_km, 10500)

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
        self.motorcycle.refresh_from_db()

        self.assertEqual(self.motorcycle.current_odometer_km, 12000)

    def test_current_odometer_recomputes_when_override_is_lowered_directly(self):
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-13",
            odometer_km=10000,
            liters=Decimal("9.000"),
            total_price=Decimal("63.00"),
            price_per_liter=Decimal("7.000"),
        )
        self.motorcycle.odometer_override_km = 15000
        self.motorcycle.save(update_fields=["odometer_override_km"])
        self.motorcycle.odometer_override_km = 9000
        self.motorcycle.save(update_fields=["odometer_override_km"])
        self.motorcycle.refresh_from_db()

        self.assertEqual(self.motorcycle.current_odometer_km, 10000)


class GarageViewTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="garage-view-user", email="garage-view@example.com", password="pass12345"
        )
        self.other_user = User.objects.create_user(
            username="garage-view-other", email="garage-view-other@example.com", password="pass12345"
        )
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
        SubscriptionProfile.objects.create(
            user=self.user,
            plan=BillingPlan.PRO,
            stripe_subscription_status="active",
        )
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
        self.assertTrue(Motorcycle.objects.filter(pk=self.motorcycle.pk).exists())
        self.assertFalse(Motorcycle.objects.get(pk=self.motorcycle.pk).is_active)
        self.assertTrue(Motorcycle.objects.filter(pk=self.other_motorcycle.pk).exists())

    def test_restore_view_reactivates_archived_motorcycle(self):
        self.motorcycle.deactivate()

        self.client.force_login(self.user)
        response = self.client.post(reverse("garage:restore", args=[self.motorcycle.pk]))

        self.assertEqual(response.status_code, 302)
        self.motorcycle.refresh_from_db()
        self.assertTrue(self.motorcycle.is_active)

    def test_update_view_rejects_odometer_override_below_history(self):
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-13",
            odometer_km=20000,
            liters=Decimal("9.000"),
            total_price=Decimal("63.00"),
            price_per_liter=Decimal("7.000"),
        )

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("garage:update", args=[self.motorcycle.pk]),
            {
                "name": self.motorcycle.name,
                "brand": self.motorcycle.brand,
                "model": self.motorcycle.model,
                "year": self.motorcycle.year,
                "license_plate": "",
                "odometer_override_km": "0",
                "riding_profile": "auto",
                "previous_owners": "",
                "purchase_price_0": "",
                "purchase_price_1": "BRL",
                "purchase_date": "",
                "observations": "",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "maior km registrado (20000 km)")

    def test_spec_update_creates_and_updates_motorcycle_spec(self):
        self.client.force_login(self.user)

        create_response = self.client.post(
            reverse("garage:spec_update", args=[self.motorcycle.pk]),
            {
                "fuel_tank_capacity_l": "14.50",
                "fuel_type_recommendation": "Gasolina aditivada",
                "fuel_octane_min": "95",
                "oil_capacity_l": "1.80",
                "oil_type_recommendation": "Sintético",
                "oil_viscosity_recommendation": "10W-40",
                "tire_size_front": "110/70R17",
                "tire_size_rear": "150/60R17",
                "tire_speed_rating": "H",
                "recommended_tire_pressure_front": "29 psi",
                "recommended_tire_pressure_rear": "33 psi",
                "battery_spec": "12V 7Ah",
                "chain_size": "520",
                "manual_reference": "Manual",
            },
        )

        self.assertEqual(create_response.status_code, 302)
        spec = MotorcycleSpec.objects.get(motorcycle=self.motorcycle)
        self.assertEqual(spec.fuel_tank_capacity_l, Decimal("14.50"))
        self.assertEqual(spec.oil_type_recommendation, "Sintético")

        update_response = self.client.post(
            reverse("garage:spec_update", args=[self.motorcycle.pk]),
            {
                "fuel_tank_capacity_l": "16.00",
                "oil_type_recommendation": "Mineral",
                "manual_reference": "Manual revisado",
            },
        )

        self.assertEqual(update_response.status_code, 302)
        self.assertEqual(MotorcycleSpec.objects.filter(motorcycle=self.motorcycle).count(), 1)
        spec.refresh_from_db()
        self.assertEqual(spec.fuel_tank_capacity_l, Decimal("16.00"))
        self.assertEqual(spec.oil_type_recommendation, "Mineral")
        self.assertEqual(spec.manual_reference, "Manual revisado")

    def test_spec_update_denies_other_user_motorcycle(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("garage:spec_update", args=[self.other_motorcycle.pk]))

        self.assertEqual(response.status_code, 404)


class MotorcycleTemplateModelTests(TestCase):
    def test_seeded_catalog_is_available_after_migrations(self):
        self.assertTrue(
            MotorcycleTemplate.objects.filter(brand="Honda", model="CG 160 Titan / Fan / Start").exists()
        )

    def test_template_autocomplete_can_find_seeded_catalog(self):
        user = get_user_model().objects.create_user(
            username="catalog-user",
            email="catalog-user@example.com",
            password="pass12345",
        )
        self.client.force_login(user)

        response = self.client.get(reverse("onboarding_template_autocomplete"), {"q": "CG 160"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "CG 160")

    def test_template_autocomplete_repopulates_empty_catalog(self):
        MotorcycleTemplateRecommendedPart.objects.all().delete()
        MotorcycleTemplateMaintenanceInterval.objects.all().delete()
        MotorcycleTemplateSpec.objects.all().delete()
        MotorcycleTemplate.objects.all().delete()
        user = get_user_model().objects.create_user(
            username="empty-catalog-user",
            email="empty-catalog-user@example.com",
            password="pass12345",
        )
        self.client.force_login(user)

        response = self.client.get(reverse("onboarding_template_autocomplete"), {"q": "CG 160"})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "CG 160")
        self.assertTrue(
            MotorcycleTemplate.objects.filter(brand="Honda", model="CG 160 Titan / Fan / Start").exists()
        )

    def test_template_rejects_invalid_year_range(self):
        template = MotorcycleTemplate(
            brand="KTM",
            model="200 Duke",
            year_from=2020,
            year_to=2019,
            engine_cc=200,
            country_code="BR",
        )
        with self.assertRaises(ValidationError):
            template.full_clean()

    def test_template_interval_requires_km_or_days(self):
        template = MotorcycleTemplate.objects.create(
            brand="KTM",
            model="200 Duke",
            year_from=2012,
            year_to=2019,
            engine_cc=200,
            country_code="BR",
        )
        interval = MotorcycleTemplateMaintenanceInterval(
            template=template,
            maintenance_type="oil_change",
        )
        with self.assertRaises(ValidationError):
            interval.full_clean()

    def test_template_spec_rejects_non_positive_capacity(self):
        template = MotorcycleTemplate.objects.create(
            brand="Kawasaki",
            model="Z400",
            year_from=2019,
            year_to=None,
            engine_cc=400,
            country_code="BR",
        )
        spec = MotorcycleTemplateSpec(
            template=template,
            fuel_tank_capacity_l=Decimal("0.00"),
        )
        with self.assertRaises(ValidationError):
            spec.full_clean()

    def test_template_spec_rejects_invalid_manual_source(self):
        template = MotorcycleTemplate.objects.create(
            brand="Kawasaki",
            model="Z400",
            year_from=2019,
            year_to=None,
            engine_cc=400,
            country_code="BR",
        )
        spec = MotorcycleTemplateSpec(
            template=template,
            manual_url="ftp://example.com/manual.pdf",
        )

        with self.assertRaises(ValidationError) as ctx:
            spec.full_clean()

        self.assertIn("manual_url", ctx.exception.message_dict)

    def test_template_spec_accepts_supported_manual_sources(self):
        template = MotorcycleTemplate.objects.create(
            brand="Kawasaki",
            model="Z400",
            year_from=2019,
            year_to=None,
            engine_cc=400,
            country_code="BR",
        )
        samples = [
            "https://example.com/manual.pdf",
            "manuals/z400-manual.pdf",
        ]

        for manual_source in samples:
            spec = MotorcycleTemplateSpec(
                template=template,
                manual_url=manual_source,
            )
            spec.full_clean()

    def test_template_spec_rejects_absolute_file_and_traversal_sources(self):
        template = MotorcycleTemplate.objects.create(
            brand="Kawasaki",
            model="Z400",
            year_from=2019,
            year_to=None,
            engine_cc=400,
            country_code="BR",
        )
        samples = [
            "file:///tmp/manual.pdf",
            "../config/settings/prod.py",
            r"C:\\manuals\\z400-manual.pdf",
        ]

        for manual_source in samples:
            spec = MotorcycleTemplateSpec(template=template, manual_url=manual_source)
            with self.subTest(manual_source=manual_source), self.assertRaises(ValidationError):
                spec.full_clean()

    def test_populate_templates_keeps_declared_year_ranges(self):
        call_command("populate_templates", verbosity=0)

        cg_templates = MotorcycleTemplate.objects.filter(brand="Honda", model="CG 160 Titan / Fan / Start")
        self.assertEqual(cg_templates.count(), 1)
        self.assertTrue(cg_templates.filter(year_from=2016, year_to=2024).exists())

    def test_populate_templates_is_idempotent(self):
        call_command("populate_templates", verbosity=0)
        first_count = MotorcycleTemplate.objects.count()

        call_command("populate_templates", verbosity=0)

        self.assertEqual(MotorcycleTemplate.objects.count(), first_count)
