from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from apps.expenses.models import AnnualFee, AnnualFeeType, InsurancePolicy
from apps.garage.models import Motorcycle


class ExpensesExportTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="expenses-user", email="expenses@example.com", password="pass12345")
        self.other_user = User.objects.create_user(
            username="expenses-other",
            email="expenses-other@example.com",
            password="pass12345",
        )
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto Taxas",
            brand="Honda",
            model="CB",
            year=2024,
        )
        self.other_motorcycle = Motorcycle.objects.create(
            owner=self.other_user,
            name="Moto de outro",
            brand="Yamaha",
            model="MT",
            year=2024,
        )

    def test_csv_export_contains_owned_fees_and_policies_only(self):
        AnnualFee.objects.create(
            motorcycle=self.motorcycle,
            fee_type=AnnualFeeType.LICENSING,
            year=2026,
            due_date=date(2026, 5, 20),
            paid_date=date(2026, 5, 10),
            amount=Decimal("180.00"),
            notes="Licenciamento pago",
        )
        InsurancePolicy.objects.create(
            motorcycle=self.motorcycle,
            provider="Seguradora Boa",
            coverage_start=date(2026, 1, 1),
            coverage_end=date(2026, 12, 31),
            premium=Decimal("1200.00"),
            notes="Cobertura anual",
        )
        AnnualFee.objects.create(
            motorcycle=self.other_motorcycle,
            fee_type=AnnualFeeType.IPVA,
            year=2026,
            due_date=date(2026, 3, 1),
            amount=Decimal("900.00"),
            notes="Não deve aparecer",
        )

        self.client.force_login(self.user)
        response = self.client.get(reverse("expenses:export_csv"))
        body = response.content.decode("utf-8-sig")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertEqual(response["Content-Disposition"], 'attachment; filename="expenses.csv"')
        self.assertIn("type,motorcycle,label,start_or_year,due_or_end,paid,amount,notes", body)
        self.assertIn("annual_fee,Moto Taxas,Licenciamento,2026,2026-05-20,2026-05-10", body)
        self.assertIn("insurance_policy,Moto Taxas,Seguradora Boa,2026-01-01,2026-12-31", body)
        self.assertNotIn("Moto de outro", body)
        self.assertNotIn("Não deve aparecer", body)

    def test_list_paginates_fees_and_policies_independently(self):
        for index in range(55):
            AnnualFee.objects.create(
                motorcycle=self.motorcycle,
                fee_type=AnnualFeeType.LICENSING,
                year=2026 + index,
                due_date=date(2026, 1, 1),
                amount=Decimal("100.00"),
            )
            InsurancePolicy.objects.create(
                motorcycle=self.motorcycle,
                provider=f"Seguradora {index:02d}",
                coverage_start=date(2026, 1, 1),
                coverage_end=date(2026, 12, 31),
                premium=Decimal("1200.00"),
            )

        self.client.force_login(self.user)
        response = self.client.get(reverse("expenses:list"), {"fees_page": 2, "policies_page": 2})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["fees"]), 5)
        self.assertEqual(len(response.context["policies"]), 5)
        self.assertEqual(response.context["fees_page_obj"].paginator.count, 55)
        self.assertEqual(response.context["policies_page_obj"].paginator.count, 55)


class ExpensesModelTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="exp-model", email="exp-model@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto Model",
            brand="Honda",
            model="CB",
            year=2024,
        )

    def test_annual_fee_clean_rejects_non_positive_notify_days(self):
        fee = AnnualFee(
            motorcycle=self.motorcycle,
            fee_type=AnnualFeeType.IPVA,
            year=2026,
            due_date=date(2026, 5, 1),
            amount="100.00",
            notify_before_days=0,
        )
        with self.assertRaises(ValidationError) as ctx:
            fee.full_clean()
        self.assertIn("notify_before_days", ctx.exception.message_dict)

    def test_annual_fee_clean_rejects_paid_before_due(self):
        fee = AnnualFee(
            motorcycle=self.motorcycle,
            fee_type=AnnualFeeType.IPVA,
            year=2026,
            due_date=date(2026, 5, 10),
            paid_date=date(2026, 5, 1),
            amount="100.00",
        )
        with self.assertRaises(ValidationError) as ctx:
            fee.full_clean()
        self.assertIn("paid_date", ctx.exception.message_dict)

    def test_insurance_policy_clean_rejects_non_positive_notify_days(self):
        policy = InsurancePolicy(
            motorcycle=self.motorcycle,
            provider="Seguro",
            coverage_start=date(2026, 1, 1),
            coverage_end=date(2026, 12, 31),
            premium="900.00",
            notify_before_days=0,
        )
        with self.assertRaises(ValidationError) as ctx:
            policy.full_clean()
        self.assertIn("notify_before_days", ctx.exception.message_dict)

    def test_insurance_policy_clean_rejects_end_before_start(self):
        policy = InsurancePolicy(
            motorcycle=self.motorcycle,
            provider="Seguro",
            coverage_start=date(2026, 12, 1),
            coverage_end=date(2026, 1, 1),
            premium="900.00",
        )
        with self.assertRaises(ValidationError) as ctx:
            policy.full_clean()
        self.assertIn("coverage_end", ctx.exception.message_dict)
