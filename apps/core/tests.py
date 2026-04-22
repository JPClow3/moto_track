from datetime import date
from decimal import Decimal
from pathlib import Path
from tempfile import NamedTemporaryFile
from unittest.mock import patch
from urllib.error import URLError

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from djmoney.money import Money

from apps.core.models import ApiToken, RecordAttachment
from apps.core.services.dashboard import get_status_cards, get_tire_cards, get_weekly_sparkline_points
from apps.core.services.notifications import notification_alerts_for_motorcycle
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
from apps.reminders.models import Reminder, TriggerType
from apps.tires.models import TirePosition, TireRecord


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
        self.assertContains(response, self.motorcycle.name)
        self.assertContains(response, "consumo")

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

    def test_odometer_quick_update_allows_lower_override_above_historical_max(self):
        self.motorcycle.odometer_override_km = 15000
        self.motorcycle.save(update_fields=["odometer_override_km"])

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("quick_odometer_update"),
            {"odometer_override_km": 11000, "next": reverse("dashboard")},
        )

        self.assertEqual(response.status_code, 302)
        self.motorcycle.refresh_from_db()
        self.assertEqual(self.motorcycle.odometer_override_km, 11000)
        self.assertEqual(self.motorcycle.current_odometer_km, 11000)

    def test_odometer_quick_update_blocks_value_below_tire_history(self):
        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.REAR,
            brand_model="Pneu historico",
            installed_at="2026-04-14",
            installed_odometer_km=13000,
            cost=Decimal("0.00"),
        )

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("quick_odometer_update"),
            {"odometer_override_km": 12000, "next": reverse("dashboard")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "maior km registrado (13000 km)")

    def test_undo_quick_fuel_creation_removes_record(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("fuel:quick_create"),
            {
                "motorcycle": self.motorcycle.pk,
                "date": "2026-04-14",
                "odometer_km": 10100,
                "liters": "5.000",
                "total_price_0": "35.00",
                "total_price_1": "BRL",
                "price_per_liter_0": "7.000",
                "price_per_liter_1": "BRL",
                "fuel_type": "gasoline",
                "next": reverse("dashboard"),
            },
        )
        self.assertEqual(response.status_code, 302)
        token = self.client.session.get("last_undo_token")
        self.assertTrue(token)
        created = FuelRecord.objects.get(odometer_km=10100)

        undo = self.client.post(reverse("undo_action", args=[token]), {"next": reverse("dashboard")})

        self.assertEqual(undo.status_code, 302)
        self.assertFalse(FuelRecord.objects.filter(pk=created.pk).exists())

    def test_record_attachment_upload_and_delete_is_owner_scoped(self):
        self.client.force_login(self.user)
        record = FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-15",
            odometer_km=10200,
            liters=Decimal("5.000"),
            total_price=Decimal("35.00"),
            price_per_liter=Decimal("7.000"),
        )
        response = self.client.post(
            reverse("attachments:create", args=["fuel", "fuelrecord", record.pk]),
            {"file": SimpleUploadedFile("nota.pdf", b"%PDF-1.4", content_type="application/pdf"), "label": "Nota"},
        )

        self.assertEqual(response.status_code, 302)
        attachment = RecordAttachment.objects.get(object_id=record.pk)
        self.assertEqual(attachment.owner, self.user)

        response = self.client.post(reverse("attachments:delete", args=[attachment.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(RecordAttachment.objects.filter(pk=attachment.pk).exists())

    def test_api_token_lists_only_owner_fuel_records(self):
        other = get_user_model().objects.create_user(username="api-other", email="api-other@example.com")
        other_motorcycle = Motorcycle.objects.create(owner=other, name="Outra", brand="Yamaha", model="MT", year=2024)
        FuelRecord.objects.create(
            motorcycle=other_motorcycle,
            date="2026-04-15",
            odometer_km=500,
            liters=Decimal("5.000"),
            total_price=Decimal("35.00"),
            price_per_liter=Decimal("7.000"),
        )
        token = ApiToken.objects.create(owner=self.user, name="Integracao", scopes="fuel:read")

        response = self.client.get(reverse("api_v1:fuel_records"), HTTP_AUTHORIZATION=f"Token {token.key}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["results"]), 1)
        self.assertEqual(payload["results"][0]["motorcycle"], self.motorcycle.name)

    def test_notification_service_includes_documents_reminders_and_tires(self):
        Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Revisao",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=100,
            reference_km=9900,
            is_active=True,
        )
        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.REAR,
            brand_model="Pneu gasto",
            installed_at=date(2026, 4, 1),
            installed_odometer_km=9900,
            cost=Decimal("500.00"),
            wear_percent=80,
            is_active=True,
        )

        alerts = notification_alerts_for_motorcycle(self.motorcycle)

        self.assertTrue(any(alert.source == "reminder" for alert in alerts))
        self.assertTrue(any(alert.source == "tires" for alert in alerts))


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
        with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(b"%PDF-1.4 test")
            tmp_path = Path(tmp.name)

        self.template.spec.manual_url = tmp_path.as_uri()
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

        tmp_path.unlink(missing_ok=True)

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

        with patch("apps.core.views.apply_template_to_motorcycle", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.client.post(reverse("onboarding"), payload)

        self.assertFalse(Motorcycle.objects.filter(owner=self.user).exists())
        self.assertEqual(FuelRecord.objects.filter(motorcycle__owner=self.user).count(), 0)
        self.assertEqual(MaintenanceRecord.objects.filter(motorcycle__owner=self.user).count(), 0)
        self.assertEqual(TireRecord.objects.filter(motorcycle__owner=self.user).count(), 0)


class DashboardServiceTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="dashboard-user", email="dashboard@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto Dashboard",
            brand="Honda",
            model="CB",
            year=2024,
            odometer_override_km=10000,
        )

    def test_weekly_sparkline_points_return_month_total(self):
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 2),
            odometer_km=9000,
            liters=Decimal("10.000"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 10),
            odometer_km=9300,
            liters=Decimal("5.000"),
            total_price=Decimal("35.00"),
            price_per_liter=Decimal("7.000"),
        )

        month_total, points = get_weekly_sparkline_points(self.motorcycle, today=date(2026, 4, 17))

        self.assertEqual(month_total, Money(105, "BRL"))
        self.assertTrue(points)

    def test_status_cards_count_pending_reminders(self):
        Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Troca de oleo",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=1000,
            reference_km=9000,
            is_active=True,
        )

        cards, pending_alerts = get_status_cards(self.motorcycle, 10000)

        self.assertEqual(pending_alerts, 1)
        reminder_card = next(card for card in cards if card["title"] == "Alertas ativos")
        self.assertEqual(reminder_card["value"], "1")

    def test_tire_cards_select_latest_active_front_and_rear(self):
        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.FRONT,
            brand_model="Front antigo",
            installed_at=date(2026, 1, 1),
            installed_odometer_km=8000,
            cost=Decimal("500.00"),
            wear_percent=10,
            is_active=True,
        )
        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.FRONT,
            brand_model="Front novo",
            installed_at=date(2026, 4, 1),
            installed_odometer_km=9500,
            cost=Decimal("600.00"),
            wear_percent=5,
            is_active=True,
        )
        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.REAR,
            brand_model="Rear novo",
            installed_at=date(2026, 4, 1),
            installed_odometer_km=9500,
            cost=Decimal("650.00"),
            wear_percent=75,
            is_active=True,
        )

        cards = get_tire_cards(self.motorcycle)

        self.assertEqual(len(cards), 2)
        self.assertEqual(cards[0]["model"], "Front novo")
        self.assertEqual(cards[1]["model"], "Rear novo")
        self.assertTrue(cards[1]["status_label"].lower().startswith("aten"))

    @override_settings(APP_BUILD_ID="test-build-123")
    def test_service_worker_uses_configured_build_id(self):
        response = self.client.get(reverse("service_worker"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("application/javascript", response["Content-Type"])
        self.assertEqual(response["Service-Worker-Allowed"], "/")
        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertContains(response, "moto-track-shell-test\\u002Dbuild\\u002D123")
