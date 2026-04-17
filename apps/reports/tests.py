from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord
from apps.reports.services import cost_summary, health_score, period_comparisons, timeline_events


class ReportOverviewTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="report-user", email="report@example.com", password="pass12345")
        self.other_user = User.objects.create_user(
            username="other-user", email="other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023
        )
        self.other_motorcycle = Motorcycle.objects.create(
            owner=self.other_user, name="Moto B", brand="Yamaha", model="MT", year=2024
        )

        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-13",
            odometer_km=10000,
            liters=Decimal("10.000"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-10",
            odometer_km=9800,
            cost=Decimal("150.00"),
        )

        FuelRecord.objects.create(
            motorcycle=self.other_motorcycle,
            date="2026-04-12",
            odometer_km=5000,
            liters=Decimal("8.000"),
            total_price=Decimal("50.00"),
            price_per_liter=Decimal("6.250"),
        )

    def test_report_overview_requires_login(self):
        response = self.client.get(reverse("reports:overview"))
        self.assertEqual(response.status_code, 302)

    def test_report_overview_returns_owner_aggregates(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("reports:overview"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["fuel_total"], Decimal("70"))
        self.assertEqual(response.context["maintenance_total"], Decimal("150"))
        self.assertEqual(response.context["fuel_records_count"], 1)
        self.assertEqual(response.context["maintenance_records_count"], 1)
        self.assertAlmostEqual(float(response.context["avg_odometer_km"]), 10000.0)

    def test_cost_period_timeline_and_health_services(self):
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-15",
            odometer_km=10200,
            liters=Decimal("8.000"),
            total_price=Decimal("56.00"),
            price_per_liter=Decimal("7.000"),
        )

        summary = cost_summary(user=self.user, motorcycle=self.motorcycle)
        comparisons = period_comparisons(user=self.user, motorcycle=self.motorcycle)
        timeline = timeline_events(user=self.user, motorcycle=self.motorcycle)
        score = health_score(motorcycle=self.motorcycle)

        self.assertEqual(summary.total, Decimal("276"))
        self.assertEqual(summary.distance_km, 400)
        self.assertEqual(len(comparisons), 3)
        self.assertTrue(any(event.source == "fuel" for event in timeline))
        self.assertGreaterEqual(score.total, 0)

    def test_timeline_view_and_exports(self):
        self.client.force_login(self.user)

        timeline = self.client.get(reverse("reports:timeline"))
        csv_response = self.client.get(reverse("reports:export_detailed_csv"))
        pdf_response = self.client.get(reverse("reports:export_sale_pdf"))

        self.assertEqual(timeline.status_code, 200)
        self.assertContains(timeline, "Histórico")
        self.assertEqual(csv_response.status_code, 200)
        self.assertEqual(csv_response["Content-Type"], "text/csv; charset=utf-8")
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response["Content-Type"], "application/pdf")
