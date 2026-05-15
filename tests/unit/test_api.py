from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.core.models import ApiToken
from apps.expenses.models import AnnualFee, InsurancePolicy
from apps.garage.models import Motorcycle


class ApiPaginationTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="api-user", email="api@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto API",
            brand="Honda",
            model="CB",
            year=2024,
        )
        self.token = ApiToken.objects.create(owner=self.user, name="API", scopes="fuel:read expenses:read")

    def _auth(self):
        return {"HTTP_AUTHORIZATION": f"Token {self.token.key}"}

    def test_malformed_pagination_returns_400(self):
        response = self.client.get(reverse("api_v1:fuel_records"), {"limit": "abc"}, **self._auth())

        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())

    def test_expenses_endpoint_applies_limit_and_offset_across_fees_and_policies(self):
        for year in range(2024, 2027):
            AnnualFee.objects.create(
                motorcycle=self.motorcycle,
                fee_type="ipva",
                year=year,
                due_date=date(year, 5, 1),
                amount=Decimal("100.00"),
            )
        InsurancePolicy.objects.create(
            motorcycle=self.motorcycle,
            provider="Seguro A",
            coverage_start=date(2026, 1, 1),
            coverage_end=date(2026, 12, 31),
            premium=Decimal("900.00"),
        )
        InsurancePolicy.objects.create(
            motorcycle=self.motorcycle,
            provider="Seguro B",
            coverage_start=date(2025, 1, 1),
            coverage_end=date(2025, 12, 31),
            premium=Decimal("800.00"),
        )

        response = self.client.get(reverse("api_v1:expenses"), {"limit": "2", "offset": "3"}, **self._auth())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 5)
        self.assertEqual(payload["limit"], 2)
        self.assertEqual(payload["offset"], 3)
        self.assertEqual([row["kind"] for row in payload["results"]], ["annual_fee", "annual_fee"])


class ApiAuthZTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="api-authz", email="authz@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto AuthZ",
            brand="Honda",
            model="CB",
            year=2024,
        )

    def test_missing_auth_returns_401(self):
        response = self.client.get(reverse("api_v1:fuel_records"))
        self.assertEqual(response.status_code, 401)
        self.assertIn("Token ausente", response.json()["detail"])

    def test_wrong_scope_returns_403(self):
        token = ApiToken.objects.create(owner=self.user, name="Scope", scopes="expenses:read")
        response = self.client.get(
            reverse("api_v1:fuel_records"),
            HTTP_AUTHORIZATION=f"Token {token.key}",
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("sem permissão", response.json()["detail"])

    def test_other_user_motorcycle_not_visible(self):
        other = get_user_model().objects.create_user(username="other-api", email="other@example.com", password="pass12345")
        Motorcycle.objects.create(owner=other, name="Outra", brand="Yamaha", model="MT", year=2024)
        token = ApiToken.objects.create(owner=self.user, name="Mine", scopes="fuel:read")
        response = self.client.get(
            reverse("api_v1:fuel_records"),
            HTTP_AUTHORIZATION=f"Token {token.key}",
        )
        self.assertEqual(response.status_code, 200)
        for row in response.json()["results"]:
            self.assertNotEqual(row["motorcycle"], "Outra")

    def test_invalid_token_format_returns_401(self):
        response = self.client.get(
            reverse("api_v1:fuel_records"),
            HTTP_AUTHORIZATION="Bearer invalid",
        )
        self.assertEqual(response.status_code, 401)

    def test_valid_token_updates_last_used_at(self):
        from apps.core.models import ApiToken
        token = ApiToken.objects.create(owner=self.user, name="Used", scopes="fuel:read")
        old_used = token.last_used_at
        response = self.client.get(
            reverse("api_v1:fuel_records"),
            HTTP_AUTHORIZATION=f"Token {token.key}",
        )
        self.assertEqual(response.status_code, 200)
        token.refresh_from_db()
        self.assertIsNotNone(token.last_used_at)
        if old_used:
            self.assertGreater(token.last_used_at, old_used)

    def test_wrong_token_hash_returns_401(self):
        from apps.core.models import ApiToken
        ApiToken.objects.create(owner=self.user, name="Wrong", scopes="fuel:read")
        response = self.client.get(
            reverse("api_v1:fuel_records"),
            HTTP_AUTHORIZATION="Token totally-wrong-key-here",
        )
        self.assertEqual(response.status_code, 401)

    def test_maintenance_records_endpoint_requires_scope(self):
        token = ApiToken.objects.create(owner=self.user, name="Maint", scopes="maintenance:read")
        from apps.maintenance.models import MaintenanceRecord, MaintenanceType
        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2024-01-01",
            odometer_km=1000,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            cost=Decimal("100.00"),
        )
        response = self.client.get(reverse("api_v1:maintenance_records"), HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["results"]), 1)

    def test_tire_records_endpoint_requires_scope(self):
        token = ApiToken.objects.create(owner=self.user, name="Tires", scopes="tires:read")
        from apps.tires.models import TirePosition, TireProduct, TireRecord
        product = TireProduct.objects.create(owner=self.user, manufacturer="Pirelli", model_name="Angel")
        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.REAR,
            installed_at="2024-01-01",
            installed_odometer_km=1000,
            tire_product=product,
            brand_model="Pirelli Angel",
            cost=Decimal("500.00"),
        )
        response = self.client.get(reverse("api_v1:tire_records"), HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(response.status_code, 200)

    def test_reminders_endpoint_requires_scope(self):
        token = ApiToken.objects.create(owner=self.user, name="Remind", scopes="reminders:read")
        from apps.reminders.models import Reminder, TriggerType
        Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Test reminder",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=5000,
            reference_km=1000,
        )
        response = self.client.get(reverse("api_v1:reminders"), HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(response.status_code, 200)

    def test_documents_endpoint_requires_scope(self):
        token = ApiToken.objects.create(owner=self.user, name="Docs", scopes="documents:read")
        from apps.documents.models import DocumentType, MotorcycleDocument
        MotorcycleDocument.objects.create(
            motorcycle=self.motorcycle,
            name="Manual",
            document_type=DocumentType.MANUAL,
        )
        response = self.client.get(reverse("api_v1:documents"), HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(response.status_code, 200)

    def test_expenses_endpoint_with_pagination(self):
        token = ApiToken.objects.create(owner=self.user, name="Exp", scopes="expenses:read")
        from apps.expenses.models import AnnualFee
        AnnualFee.objects.create(
            motorcycle=self.motorcycle,
            fee_type="ipva",
            year=2024,
            due_date="2024-05-01",
            amount=Decimal("100.00"),
        )
        response = self.client.get(reverse("api_v1:expenses"), {"limit": "1"}, HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(len(payload["results"]), 1)

    def test_pagination_limit_clamped(self):
        token = ApiToken.objects.create(owner=self.user, name="Page", scopes="fuel:read")
        response = self.client.get(
            reverse("api_v1:fuel_records"),
            {"limit": "999", "offset": "-5"},
            HTTP_AUTHORIZATION=f"Token {token.key}",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["limit"], 100)
        self.assertEqual(payload["offset"], 0)

    def test_api_returns_json_even_when_html_is_accepted(self):
        token = ApiToken.objects.create(owner=self.user, name="Html", scopes="fuel:read")
        response = self.client.get(
            reverse("api_v1:fuel_records"),
            HTTP_AUTHORIZATION=f"Token {token.key}",
            HTTP_ACCEPT="text/html",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("application/json", response["Content-Type"])
        self.assertIn("results", response.json())
