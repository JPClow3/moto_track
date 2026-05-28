from datetime import UTC, date, timedelta
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.core.models import ApiToken, PushSubscription, SiteSettings
from apps.core.services.notifications import notification_alerts_for_motorcycle
from apps.core.undo import SESSION_KEY as UNDO_SESSION_KEY
from apps.fuel.models import FuelRecord
from apps.garage.models import (
    Motorcycle,
)
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
        self.assertContains(response, "A garagem digital da sua moto")
        self.assertContains(response, '<link rel="canonical" href="http://testserver/"')
        self.assertContains(response, '"@type": "WebSite"')
        self.assertContains(response, '"@type": "Organization"')

    def test_landing_canonical_ignores_query_string(self):
        response = self.client.get(f"{reverse('landing')}?utm_source=test&utm_campaign=seo")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<link rel="canonical" href="http://testserver/"')
        self.assertNotContains(response, "utm_source=test")

    def test_landing_does_not_create_site_settings_row(self):
        SiteSettings.objects.all().delete()

        response = self.client.get(reverse("landing"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(SiteSettings.objects.count(), 0)

    def test_landing_redirects_authenticated_user_to_dashboard(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("landing"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("dashboard"), response["Location"])

    def test_dashboard_renders_for_authenticated_user(self):
        self.client.force_login(self.user)
        with override_settings(APP_BUILD_ID="dashboard-build"):
            response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.motorcycle.name)
        self.assertContains(response, "consumo")
        self.assertContains(response, 'role="img"')
        self.assertContains(response, f'{reverse("service_worker")}?v=dashboard-build')
        self.assertContains(response, 'id="spendingChartSummary"')
        self.assertContains(response, 'data-theme="system"')
        self.assertContains(response, "data-theme-toggle")
        self.assertNotContains(response, "{#")

    def test_quick_forms_render_iso_default_dates(self):
        self.client.force_login(self.user)
        today = timezone.localdate().isoformat()

        fuel_response = self.client.get(reverse("fuel:quick_create"))
        maintenance_response = self.client.get(reverse("maintenance:quick_create"))

        self.assertEqual(fuel_response.status_code, 200)
        self.assertContains(fuel_response, f'value="{today}"')
        self.assertEqual(maintenance_response.status_code, 200)
        self.assertContains(maintenance_response, f'value="{today}"')

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

    def test_odometer_quick_update_replay_is_idempotent(self):
        ClientSubmission = self.motorcycle._meta.apps.get_model("core", "ClientSubmission")
        token = "odometer-replay-token"

        self.client.force_login(self.user)
        for _ in range(2):
            response = self.client.post(
                reverse("quick_odometer_update"),
                {
                    "odometer_override_km": 12000,
                    "next": reverse("dashboard"),
                    "client_submission_id": token,
                },
            )
            self.assertEqual(response.status_code, 302)

        self.motorcycle.refresh_from_db()
        self.assertEqual(self.motorcycle.odometer_override_km, 12000)
        submission = ClientSubmission.objects.get(owner=self.user, token=token)
        self.assertEqual(submission.action, "quick_odometer_update")
        self.assertEqual(submission.result_model, "garage.Motorcycle")
        self.assertEqual(submission.result_pk, self.motorcycle.pk)

    def test_record_client_submission_updates_existing_token_idempotently(self):
        from apps.core.models import ClientSubmission
        from apps.core.services.idempotency import record_client_submission

        request = RequestFactory().post("/", {"client_submission_id": "repeat-token"})
        request.user = self.user

        record_client_submission(
            request,
            token="repeat-token",
            action="quick_odometer_update",
            result=self.motorcycle,
        )
        record_client_submission(
            request,
            token="repeat-token",
            action="quick_odometer_update",
            result=self.motorcycle,
        )

        self.assertEqual(ClientSubmission.objects.filter(owner=self.user, token="repeat-token").count(), 1)
        submission = ClientSubmission.objects.get(owner=self.user, token="repeat-token")
        self.assertEqual(submission.result_model, "garage.Motorcycle")
        self.assertEqual(submission.result_pk, self.motorcycle.pk)

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
        # B-M10: endpoint is encrypted at rest, look up by endpoint_hash instead.
        from apps.core.models import _hash_endpoint

        other = get_user_model().objects.create_user(username="push-other", email="push-other@example.com")
        endpoint = "https://push.example/subscription/1"
        endpoint_hash = _hash_endpoint(endpoint)
        PushSubscription.objects.create(owner=other, endpoint=endpoint, p256dh="old-key", auth="old-auth")

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("push_subscribe"),
            data='{"endpoint":"https://push.example/subscription/1","keys":{"p256dh":"new-key","auth":"new-auth"}}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(PushSubscription.objects.filter(endpoint_hash=endpoint_hash).count(), 2)
        old_sub = PushSubscription.objects.get(owner=other, endpoint_hash=endpoint_hash)
        self.assertEqual(old_sub.p256dh, "old-key")
        new_sub = PushSubscription.objects.get(owner=self.user, endpoint_hash=endpoint_hash)
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
        expires_at = (timezone.now().astimezone(UTC) + timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
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


class EncryptedFieldTests(TestCase):
    def test_fernet_key_uses_push_encryption_key_when_set(self):
        from django.test import override_settings

        from apps.core.fields import _get_fernet
        with override_settings(PUSH_ENCRYPTION_KEY="custom-key-for-testing-1234567890"):
            fernet = _get_fernet()
            encrypted = fernet.encrypt(b"hello")
            decrypted = fernet.decrypt(encrypted)
            self.assertEqual(decrypted, b"hello")

    def test_fernet_key_falls_back_to_secret_key(self):
        from django.test import override_settings

        from apps.core.fields import _get_fernet
        with override_settings(SECRET_KEY="fallback-secret-key-1234567890"):
            # Ensure PUSH_ENCRYPTION_KEY is absent from settings
            from django.conf import settings
            original = getattr(settings, "PUSH_ENCRYPTION_KEY", None)
            try:
                if hasattr(settings, "PUSH_ENCRYPTION_KEY"):
                    delattr(settings, "PUSH_ENCRYPTION_KEY")
                fernet = _get_fernet()
                encrypted = fernet.encrypt(b"hello")
                decrypted = fernet.decrypt(encrypted)
                self.assertEqual(decrypted, b"hello")
            finally:
                if original is not None:
                    settings.PUSH_ENCRYPTION_KEY = original

    def test_encrypted_field_roundtrip(self):
        from django.db import connection

        from apps.core.fields import EncryptedCharField
        field = EncryptedCharField(max_length=255)
        encrypted = field.get_prep_value("secret text")
        self.assertNotEqual(encrypted, "secret text")
        decrypted = field.from_db_value(encrypted, None, connection)
        self.assertEqual(decrypted, "secret text")

    def test_encrypted_field_returns_none_for_none(self):
        from django.db import connection

        from apps.core.fields import EncryptedCharField
        field = EncryptedCharField(max_length=255)
        self.assertIsNone(field.from_db_value(None, None, connection))
        self.assertIsNone(field.get_prep_value(None))

    def test_encrypted_field_returns_none_for_invalid_token(self):
        from django.db import connection

        from apps.core.fields import EncryptedCharField
        field = EncryptedCharField(max_length=255)
        decrypted = field.from_db_value("not-valid-fernet-token==", None, connection)
        self.assertIsNone(decrypted)

    def test_encrypted_field_to_python_passthrough(self):
        from apps.core.fields import EncryptedCharField
        field = EncryptedCharField(max_length=255)
        self.assertEqual(field.to_python("plain"), "plain")
        self.assertIsNone(field.to_python(None))


class CoreMiscViewTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="misc-user", email="misc@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto Misc", brand="Honda", model="CB", year=2023
        )

    def test_onboarding_template_preview_empty(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("onboarding_template_preview"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"")

    def test_odometer_quick_update_get(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("quick_odometer_update"))
        self.assertEqual(response.status_code, 200)

    def test_odometer_quick_update_post(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("quick_odometer_update"), {"odometer_override_km": 15000})
        self.assertEqual(response.status_code, 302)
        self.motorcycle.refresh_from_db()
        self.assertEqual(self.motorcycle.current_odometer_km, 15000)

    def test_quick_add_selector(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("quick_add"))
        self.assertEqual(response.status_code, 200)

    def test_offline_page(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("offline"))
        self.assertEqual(response.status_code, 200)

    def test_offline_page_is_public_and_cacheable(self):
        response = self.client.get(reverse("offline"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("public", response["Cache-Control"])
        self.assertContains(response, "Sincronizar")

    def test_manifest_view(self):
        response = self.client.get(reverse("manifest"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["name"], "Moto Track")
        self.assertEqual(data["id"], "/")
        self.assertEqual(data["scope"], "/")
        self.assertEqual(data["start_url"], "/dashboard/?source=pwa")
        self.assertEqual(data["display"], "standalone")
        self.assertIn("categories", data)
        self.assertIn("description", data)
        self.assertTrue(any(icon["sizes"] == "192x192" for icon in data["icons"]))
        self.assertTrue(any(icon["sizes"] == "512x512" for icon in data["icons"]))
        self.assertTrue(any("maskable" in icon.get("purpose", "") for icon in data["icons"]))

    def test_manifest_view_dark_mode(self):
        response = self.client.get(reverse("manifest"), {"mode": "dark", "resolved": "dark"})
        self.assertEqual(response.status_code, 200)

    def test_service_worker(self):
        response = self.client.get(reverse("service_worker"))
        body = b"".join(response.streaming_content).decode()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/javascript")
        self.assertIn("OFFLINE_QUEUE_SYNC", body)
        self.assertIn("/static/js/offline-queue.js", body)
        self.assertIn("/manifest.webmanifest", body)
        self.assertIn("android-chrome-192x192.png", body)
        self.assertIn("QUEUEABLE_PATHS.includes", body)
        self.assertIn("fuel:quick_create", body)
        self.assertIn("/trabalho/turnos/novo/", body)
        self.assertIn("work:session_create", body)
        self.assertIn("offlineQueuedFragmentResponse", body)
        self.assertIn('if (req.mode === "navigate")', body)
        self.assertIn("cache.match(OFFLINE_URL)", body)

    def test_service_worker_returns_404_when_asset_is_missing(self):
        with TemporaryDirectory() as tmpdir, override_settings(PUBLIC_ROOT=Path(tmpdir)):
            response = self.client.get(reverse("service_worker"))

        self.assertEqual(response.status_code, 404)

    def test_pwa_status_requires_login(self):
        response = self.client.get(reverse("pwa_status"))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["authenticated"])
        self.assertIn(reverse("account_login"), response.json()["login_url"])

    def test_pwa_status_returns_fresh_csrf_for_authenticated_user(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("pwa_status"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["authenticated"])
        self.assertTrue(payload["csrf_token"])

    def test_undo_action_missing_token(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("undo_action", args=["no-such-token"]), {"next": reverse("dashboard")})
        self.assertEqual(response.status_code, 302)

    def test_demo_bike_create_redirects_when_has_moto(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("demo_bike_create"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], reverse("dashboard"))

    def test_push_subscribe_invalid_json(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("push_subscribe"), data="not-json", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid JSON", response.json()["error"])

    def test_push_subscribe_missing_data(self):
        self.client.force_login(self.user)
        import json
        response = self.client.post(reverse("push_subscribe"), data=json.dumps({"endpoint": "https://e"}), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid subscription data", response.json()["error"])

    def test_push_subscribe_success(self):
        self.client.force_login(self.user)
        import json
        payload = {"endpoint": "https://example.com/push", "keys": {"p256dh": "abc", "auth": "def"}}
        response = self.client.post(reverse("push_subscribe"), data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_theme_preference_invalid(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("theme_preference"), {"theme": "invalid"})
        self.assertEqual(response.status_code, 400)

    def test_theme_preference_valid(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("theme_preference"), {"theme": "dark"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["theme"], "dark")

    def test_message_list(self):
        self.client.force_login(self.user)
        self.client.post(
            reverse("quick_odometer_update"),
            {"odometer_override_km": 12000, "next": reverse("dashboard")},
        )

        response = self.client.get(reverse("message_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="snackbar"')
        self.assertContains(response, "data-auto-dismiss-toast")
        self.assertContains(response, "Odometro atualizado com sucesso.")


class SentryInitializationTests(TestCase):
    @override_settings(SENTRY_DSN="")
    def test_sentry_skipped_when_dsn_missing(self):
        """SENTRY_DSN absent => sentry.init must not raise and views remain reachable."""
        response = self.client.get(reverse("landing"))
        self.assertEqual(response.status_code, 200)
