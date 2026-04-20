from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from djmoney.money import Money

from apps.core.models import ApiToken, RecordAttachment
from apps.core.services.dashboard import get_status_cards, get_tire_cards, get_weekly_sparkline_points
from apps.core.services.notifications import notification_alerts_for_motorcycle
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord
from apps.reminders.models import Reminder, TriggerType
from apps.tires.models import TirePosition, TireRecord


class CoreViewsTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="core-user", email="core@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023
        )
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
        self.assertContains(response, "Média de consumo")

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
            brand_model="Pneu histórico",
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
        token = ApiToken.objects.create(owner=self.user, name="Integração", scopes="fuel:read")

        response = self.client.get(reverse("api_v1:fuel_records"), HTTP_AUTHORIZATION=f"Token {token.key}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["results"]), 1)
        self.assertEqual(payload["results"][0]["motorcycle"], self.motorcycle.name)

    def test_notification_service_includes_documents_reminders_and_tires(self):
        Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Revisão",
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

    def test_dashboard_redirects_to_onboarding_without_motorcycle(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("onboarding"), response["Location"])

    def test_onboarding_creates_initial_history(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("onboarding"),
            {
                "motorcycle_name": "Minha moto",
                "brand": "Honda",
                "model": "CB",
                "year": "2024",
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
            },
        )
        self.assertEqual(response.status_code, 302)
        motorcycle = Motorcycle.objects.get(owner=self.user)
        self.assertEqual(motorcycle.current_odometer_km, 1000)
        self.assertEqual(FuelRecord.objects.filter(motorcycle=motorcycle).count(), 1)
        self.assertEqual(MaintenanceRecord.objects.filter(motorcycle=motorcycle).count(), 1)
        self.assertEqual(TireRecord.objects.filter(motorcycle=motorcycle).count(), 2)


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
            title="Troca de óleo",
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
        self.assertEqual(cards[1]["status_label"], "Atenção")

    @override_settings(APP_BUILD_ID="test-build-123")
    def test_service_worker_uses_configured_build_id(self):
        response = self.client.get(reverse("service_worker"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("application/javascript", response["Content-Type"])
        self.assertEqual(response["Service-Worker-Allowed"], "/")
        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertContains(response, "moto-track-shell-test\\u002Dbuild\\u002D123")
