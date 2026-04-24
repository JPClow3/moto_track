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
        self.assertEqual([row["kind"] for row in payload["results"]], ["insurance", "insurance"])


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
