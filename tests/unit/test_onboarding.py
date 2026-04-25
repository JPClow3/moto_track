import shutil
import tempfile
from decimal import Decimal
from unittest.mock import patch
from urllib.error import URLError

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from djmoney.money import Money

from apps.documents.models import DocumentType, MotorcycleDocument
from apps.fuel.models import FuelRecord
from apps.garage.models import (
    Motorcycle,
    MotorcycleTemplate,
    MotorcycleTemplateMaintenanceInterval,
    MotorcycleTemplateRecommendedPart,
    MotorcycleTemplateSpec,
)
from apps.maintenance.models import MaintenancePart, MaintenanceRecord
from apps.tires.models import TireRecord


class OnboardingTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="new-user", email="new@example.com", password="pass12345")
        self.template = MotorcycleTemplate.objects.create(
            brand="KTM",
            model="200 Duke",
            year_from=2012,
            year_to=2019,
            variant="ABS",
            engine_cc=200,
            country_code="BR",
        )
        MotorcycleTemplateSpec.objects.create(
            template=self.template,
            fuel_tank_capacity_l=Decimal("11.00"),
            fuel_type_recommendation="Gasolina",
            fuel_octane_min=95,
            oil_capacity_l=Decimal("1.70"),
            oil_type_recommendation="Sintetico",
            oil_viscosity_recommendation="10W-40",
            tire_size_front="110/70R17",
            tire_size_rear="150/60R17",
            tire_speed_rating="H",
            recommended_tire_pressure_front="29 psi",
            recommended_tire_pressure_rear="33 psi",
            battery_spec="12V 8Ah",
            chain_size="520",
            manual_url="",
        )
        MotorcycleTemplateMaintenanceInterval.objects.create(
            template=self.template,
            maintenance_type="oil_change",
            interval_km=5000,
            interval_days=180,
            notes="Normal",
            is_severe_duty_override=False,
        )
        MotorcycleTemplateMaintenanceInterval.objects.create(
            template=self.template,
            maintenance_type="oil_change",
            interval_km=3000,
            interval_days=120,
            notes="Severo",
            is_severe_duty_override=True,
        )
        MotorcycleTemplateRecommendedPart.objects.create(
            template=self.template,
            maintenance_type="oil_change",
            part_name="Filtro de oleo OEM",
            manufacturer="KTM",
            part_number="KTM-001",
            notes="Trocar junto com oleo",
        )

    def _base_payload(self) -> dict:
        return {
            "motorcycle_name": "Minha moto",
            "brand": "KTM",
            "model": "200 Duke",
            "year": "2018",
            "current_odometer_km": "1000",
            "riding_profile": "auto",
            "fuel_date": "2026-04-10",
            "fuel_odometer_km": "950",
            "fuel_liters": "10.000",
            "fuel_total_price": "70.00",
            "service_date": "2026-04-11",
            "service_odometer_km": "960",
            "service_cost": "120.00",
            "front_tire": "Pneu dianteiro",
            "rear_tire": "Pneu traseiro",
            "tire_installed_at": "2026-04-09",
            "tire_odometer_km": "900",
            "fuel_tank_capacity_l": "11.00",
            "fuel_type_recommendation": "Gasolina",
            "fuel_octane_min": "95",
            "oil_capacity_l": "1.70",
            "oil_type_recommendation": "Sintetico",
            "oil_viscosity_recommendation": "10W-40",
            "tire_size_front": "110/70R17",
            "tire_size_rear": "150/60R17",
            "tire_speed_rating": "H",
            "recommended_tire_pressure_front": "29 psi",
            "recommended_tire_pressure_rear": "33 psi",
            "battery_spec": "12V 8Ah",
            "chain_size": "520",
            "manual_reference": "Manual de fabrica",
        }

    def test_dashboard_redirects_to_onboarding_without_motorcycle(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("onboarding"), response["Location"])

    def test_onboarding_redirects_to_garage_when_user_has_archived_motorcycle(self):
        Motorcycle.objects.create(
            owner=self.user,
            name="Arquivada",
            brand="Honda",
            model="Biz",
            year=2020,
            is_active=False,
        )

        self.client.force_login(self.user)
        response = self.client.get(reverse("onboarding"))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("garage:list"), response["Location"])

    def test_onboarding_without_template_keeps_current_flow(self):
        self.client.force_login(self.user)
        payload = self._base_payload()
        payload["brand"] = "Honda"
        payload["model"] = "CB"
        payload["year"] = "2024"
        response = self.client.post(reverse("onboarding"), payload)
        self.assertEqual(response.status_code, 302)

        motorcycle = Motorcycle.objects.get(owner=self.user)
        self.assertIsNone(motorcycle.source_template)
        self.assertEqual(motorcycle.current_odometer_km, 1000)
        self.assertEqual(FuelRecord.objects.filter(motorcycle=motorcycle).count(), 1)
        self.assertEqual(MaintenanceRecord.objects.filter(motorcycle=motorcycle).count(), 1)
        self.assertEqual(TireRecord.objects.filter(motorcycle=motorcycle).count(), 2)

    def test_onboarding_with_template_creates_spec_plan_parts_and_manual(self):
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)

        with override_settings(MEDIA_ROOT=media_root):
            default_storage.save("manuals/ktm-200.pdf", ContentFile(b"%PDF-1.4 test"))
            self.template.spec.manual_url = "manuals/ktm-200.pdf"
            self.template.spec.save(update_fields=["manual_url"])

            self.client.force_login(self.user)
            payload = self._base_payload()
            payload["template"] = str(self.template.pk)
            payload["template_variant"] = "Carburada"
            payload["tire_size_front"] = "120/70R17"
            response = self.client.post(reverse("onboarding"), payload)
            self.assertEqual(response.status_code, 302)

            motorcycle = Motorcycle.objects.get(owner=self.user)
            self.assertEqual(motorcycle.source_template_id, self.template.id)
            self.assertIn("Variante: Carburada", motorcycle.observations)
            self.assertEqual(
                motorcycle.spec.tire_size_front,
                "120/70R17",
            )
            self.assertEqual(
                motorcycle.spec.oil_type_recommendation,
                "Sintetico",
            )

            plan_items = motorcycle.maintenance_plan_items.filter(maintenance_type="oil_change")
            self.assertEqual(plan_items.count(), 2)
            self.assertTrue(plan_items.filter(is_severe_duty_override=True).exists())
            self.assertTrue(plan_items.filter(is_severe_duty_override=False).exists())

            part_qs = MaintenancePart.objects.filter(owner=self.user, name="Filtro de oleo OEM")
            self.assertEqual(part_qs.count(), 1)

            manual_doc = MotorcycleDocument.objects.filter(
                motorcycle=motorcycle,
                document_type=DocumentType.MANUAL,
            )
            self.assertEqual(manual_doc.count(), 1)

    def test_onboarding_template_part_get_or_create_avoids_duplicates(self):
        MaintenancePart.objects.create(owner=self.user, name="Filtro de oleo OEM", manufacturer="Outro")

        self.client.force_login(self.user)
        payload = self._base_payload()
        payload["template"] = str(self.template.pk)
        response = self.client.post(reverse("onboarding"), payload)
        self.assertEqual(response.status_code, 302)

        self.assertEqual(MaintenancePart.objects.filter(owner=self.user, name="Filtro de oleo OEM").count(), 1)

    def test_onboarding_rejects_template_year_out_of_range(self):
        self.client.force_login(self.user)
        payload = self._base_payload()
        payload["template"] = str(self.template.pk)
        payload["year"] = "2022"
        response = self.client.post(reverse("onboarding"), payload)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "intervalo do template")
        self.assertContains(response, 'data-onboarding-error-summary')
        self.assertContains(response, 'data-initial-step="2"')
        self.assertContains(response, 'data-wizard-nav')
        self.assertContains(response, 'Pré-preenchido pelo catálogo')

    def test_onboarding_downloads_manual_from_external_url(self):
        self.template.spec.manual_url = "https://example.com/manual.pdf"
        self.template.spec.save(update_fields=["manual_url"])

        class _Response:
            def __init__(self):
                self.url = "https://example.com/files/manual-final.pdf"

            def read(self):
                return b"%PDF-1.4 external"

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

        self.client.force_login(self.user)
        payload = self._base_payload()
        payload["template"] = str(self.template.pk)
        with patch("apps.garage.services.urlopen", return_value=_Response()):
            response = self.client.post(reverse("onboarding"), payload)
        self.assertEqual(response.status_code, 302)

        motorcycle = Motorcycle.objects.get(owner=self.user)
        self.assertTrue(
            MotorcycleDocument.objects.filter(
                motorcycle=motorcycle,
                document_type=DocumentType.MANUAL,
            ).exists()
        )

    def test_onboarding_manual_download_failure_does_not_block(self):
        self.template.spec.manual_url = "https://example.com/manual.pdf"
        self.template.spec.save(update_fields=["manual_url"])

        self.client.force_login(self.user)
        payload = self._base_payload()
        payload["template"] = str(self.template.pk)
        with patch("apps.garage.services.urlopen", side_effect=URLError("network down")):
            response = self.client.post(reverse("onboarding"), payload)
        self.assertEqual(response.status_code, 302)

        motorcycle = Motorcycle.objects.get(owner=self.user)
        self.assertFalse(
            MotorcycleDocument.objects.filter(
                motorcycle=motorcycle,
                document_type=DocumentType.MANUAL,
            ).exists()
        )

    def test_onboarding_rolls_back_all_writes_when_template_apply_fails(self):
        self.client.force_login(self.user)
        payload = self._base_payload()
        payload["template"] = str(self.template.pk)

        with patch("apps.core.services.onboarding.apply_template_to_motorcycle", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.client.post(reverse("onboarding"), payload)

        self.assertFalse(Motorcycle.objects.filter(owner=self.user).exists())
        self.assertEqual(FuelRecord.objects.filter(motorcycle__owner=self.user).count(), 0)
        self.assertEqual(MaintenanceRecord.objects.filter(motorcycle__owner=self.user).count(), 0)
        self.assertEqual(TireRecord.objects.filter(motorcycle__owner=self.user).count(), 0)
