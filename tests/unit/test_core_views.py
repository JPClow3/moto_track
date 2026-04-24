from datetime import date, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from djmoney.money import Money

from apps.core.models import ApiToken, PushSubscription
from apps.core.services.dashboard import get_status_cards, get_tire_cards, get_weekly_sparkline_points
from apps.core.services.notifications import notification_alerts_for_motorcycle
from apps.core.undo import SESSION_KEY as UNDO_SESSION_KEY
from apps.fuel.models import FuelRecord
from apps.forum.models import ForumArticle
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

    def test_landing_renders_for_anonymous_user(self):
        response = self.client.get(reverse("landing"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "<h1")
        self.assertContains(response, "Moto Track")
        self.assertContains(response, '<meta name="description"')
        self.assertContains(response, "Controle sua moto com precisão")

    def test_landing_redirects_authenticated_user_to_dashboard(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("landing"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("dashboard"), response["Location"])

    def test_dashboard_renders_for_authenticated_user(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.motorcycle.name)
        self.assertContains(response, "consumo")
        self.assertContains(response, 'role="img"')
        self.assertContains(response, 'id="spendingChartSummary"')
        self.assertContains(response, 'data-theme="system"')
        self.assertContains(response, "data-theme-toggle")

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
        self.motorcycle.refresh_from_db()

        alerts = notification_alerts_for_motorcycle(self.motorcycle)

        self.assertTrue(any(alert.source == "reminder" for alert in alerts))
        self.assertTrue(any(alert.source == "tires" for alert in alerts))

    def test_push_subscription_same_endpoint_stays_owner_scoped(self):
        other = get_user_model().objects.create_user(username="push-other", email="push-other@example.com")
        endpoint = "https://push.example/subscription/1"
        PushSubscription.objects.create(owner=other, endpoint=endpoint, p256dh="old-key", auth="old-auth")

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("push_subscribe"),
            data='{"endpoint":"https://push.example/subscription/1","keys":{"p256dh":"new-key","auth":"new-auth"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(PushSubscription.objects.filter(endpoint=endpoint).count(), 2)
        old_sub = PushSubscription.objects.get(owner=other, endpoint=endpoint)
        self.assertEqual(old_sub.p256dh, "old-key")
        new_sub = PushSubscription.objects.get(owner=self.user, endpoint=endpoint)
        self.assertEqual(new_sub.p256dh, "new-key")

    def test_undo_token_consumption_purges_expired_session_entries(self):
        self.client.force_login(self.user)
        record = FuelRecord.objects.filter(motorcycle=self.motorcycle).first()
        session = self.client.session
        session[UNDO_SESSION_KEY] = {
            "expired": {
                "model": "fuel.FuelRecord",
                "object_id": record.pk,
                "label": "Expirado",
                "expires_at": (timezone.now() - timedelta(minutes=1)).isoformat(),
            },
            "fresh": {
                "model": "fuel.FuelRecord",
                "object_id": record.pk,
                "label": "Valido",
                "expires_at": (timezone.now() + timedelta(minutes=10)).isoformat(),
            },
        }
        session["last_undo_token"] = "expired"
        session.save()

        response = self.client.post(reverse("undo_action", args=["expired"]), {"next": reverse("dashboard")})

        self.assertEqual(response.status_code, 302)
        actions = self.client.session[UNDO_SESSION_KEY]
        self.assertEqual(list(actions.keys()), ["fresh"])
        self.assertNotIn("last_undo_token", self.client.session)

    def test_undo_token_accepts_utc_z_suffix_expiration(self):
        self.client.force_login(self.user)
        record = FuelRecord.objects.filter(motorcycle=self.motorcycle).first()
        self.assertIsNotNone(record)
        expires_at = (timezone.now().astimezone(dt_timezone.utc) + timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
        session = self.client.session
        session[UNDO_SESSION_KEY] = {
            "z-token": {
                "model": "fuel.FuelRecord",
                "object_id": record.pk,
                "label": "Valido Z",
                "expires_at": expires_at,
            }
        }
        session["last_undo_token"] = "z-token"
        session.save()

        response = self.client.post(reverse("undo_action", args=["z-token"]), {"next": reverse("dashboard")})

        self.assertEqual(response.status_code, 302)
        self.assertFalse(FuelRecord.objects.filter(pk=record.pk).exists())
        self.assertNotIn("z-token", self.client.session[UNDO_SESSION_KEY])

    def test_request_id_header_is_present(self):
        response = self.client.get(reverse("account_login"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("X-Request-ID", response)

    @override_settings(DEBUG=True)
    def test_status_preview_renders_non_error_families(self):
        response = self.client.get(reverse("status_preview", args=[300]))

        self.assertEqual(response.status_code, 300)
        self.assertContains(response, "Redirecionamento", status_code=300)

    @override_settings(DEBUG=False)
    def test_status_preview_is_hidden_when_debug_disabled(self):
        response = self.client.get(reverse("status_preview", args=[500]))

        self.assertEqual(response.status_code, 404)

    @override_settings(DEBUG=False)
    def test_not_found_uses_custom_error_page(self):
        response = self.client.get("/rota-que-nao-existe/", follow=False)

        self.assertEqual(response.status_code, 404)
        self.assertContains(response, "Pagina nao encontrada", status_code=404)

    def test_request_id_middleware_logs_unhandled_exception(self):
        from config.middleware import RequestIDMiddleware

        request = RequestFactory().get("/falha/")
        middleware = RequestIDMiddleware(lambda _request: (_ for _ in ()).throw(RuntimeError("boom")))

        with self.assertLogs("config.middleware", level="ERROR") as logs:
            with self.assertRaises(RuntimeError):
                middleware(request)

        self.assertTrue(any("Unhandled exception" in line for line in logs.output))

    def test_roadmap_renders_for_anonymous_user(self):
        response = self.client.get(reverse("roadmap"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Roadmap")
        self.assertContains(response, "Estado atual")
        self.assertContains(response, "Funcionalidades planejadas")
        self.assertContains(response, "Melhorias planejadas")
        self.assertContains(response, "Correções planejadas")
        self.assertContains(response, "Problemas conhecidos")


class SentryInitializationTests(TestCase):
    @override_settings(SENTRY_DSN="")
    def test_sentry_skipped_when_dsn_missing(self):
        """SENTRY_DSN absent => sentry.init must not raise and views remain reachable."""
        response = self.client.get(reverse("landing"))
        self.assertEqual(response.status_code, 200)
