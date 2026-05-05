from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from djmoney.money import Money

from apps.core.services.dashboard import get_status_cards, get_tire_cards, get_weekly_sparkline_points
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.reminders.models import Reminder, TriggerType
from apps.tires.models import TirePosition, TireRecord


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

        from apps.core.services.dashboard import get_active_reminders
        active_reminders = get_active_reminders(self.motorcycle, 10000)
        cards, pending_alerts = get_status_cards(self.motorcycle, 10000, active_reminders)

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
        self.assertContains(response, "indexedDB")
        self.assertContains(response, "moto-track-offline-queue")
        self.assertContains(response, "showNotification")
        self.assertContains(response, "notificationclick")

    def test_manifest_uses_resolved_theme_palette(self):
        response = self.client.get(reverse("manifest"), {"mode": "system", "resolved": "dark"})

        self.assertEqual(response.status_code, 200)
        self.assertIn("application/manifest+json", response["Content-Type"])
        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertEqual(response.json()["background_color"], "#09090B")
        self.assertEqual(response.json()["theme_color"], "#09090B")
