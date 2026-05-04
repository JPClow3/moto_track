from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from apps.billing.models import BillingPlan, SubscriptionProfile
from apps.expenses.models import AnnualFee, InsurancePolicy
from apps.fuel.models import FuelRecord, FuelStation
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.reminders.models import Reminder, TriggerType
from apps.reports.services import (
    cost_summary,
    health_score,
    intelligent_alerts,
    period_comparisons,
    sale_report_data,
    timeline_events,
    timeline_events_count,
)
from apps.tires.models import TirePosition, TirePressureRecord, TireRecord


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

    def _grant_pro(self):
        SubscriptionProfile.objects.update_or_create(
            user=self.user,
            defaults={"plan": BillingPlan.PRO, "stripe_subscription_status": "active"},
        )

    def test_report_overview_requires_login(self):
        response = self.client.get(reverse("reports:overview"))
        self.assertEqual(response.status_code, 302)

    def test_report_overview_returns_owner_aggregates(self):
        self._grant_pro()
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
        self._grant_pro()
        self.client.force_login(self.user)

        timeline = self.client.get(reverse("reports:timeline"))
        csv_response = self.client.get(reverse("reports:export_detailed_csv"))
        pdf_response = self.client.get(reverse("reports:export_sale_pdf"))

        self.assertEqual(timeline.status_code, 200)
        self.assertContains(timeline, "Linha do tempo")
        self.assertEqual(csv_response.status_code, 200)
        self.assertEqual(csv_response["Content-Type"], "text/csv; charset=utf-8")
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response["Content-Type"], "application/pdf")

    def test_timeline_events_support_bounded_fetch_and_count(self):
        for idx in range(10):
            FuelRecord.objects.create(
                motorcycle=self.motorcycle,
                date=f"2026-04-{idx + 1:02d}",
                odometer_km=9000 + idx * 100,
                liters=Decimal("8.000"),
                total_price=Decimal("56.00"),
                price_per_liter=Decimal("7.000"),
            )

        total = timeline_events_count(user=self.user, motorcycle=self.motorcycle)
        events = timeline_events(user=self.user, motorcycle=self.motorcycle, limit=5)

        self.assertEqual(total, 12)
        self.assertEqual(len(events), 5)

    @override_settings(
        CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "test-reports"}}
    )
    def test_timeline_events_refresh_after_new_write(self):
        initial = timeline_events(user=self.user, motorcycle=self.motorcycle)

        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-20",
            odometer_km=10400,
            liters=Decimal("7.000"),
            total_price=Decimal("49.00"),
            price_per_liter=Decimal("7.000"),
        )

        refreshed = timeline_events(user=self.user, motorcycle=self.motorcycle)

        self.assertEqual(len(refreshed), len(initial) + 1)
        self.assertEqual(refreshed[0].odometer_km, 10400)

    @override_settings(
        CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "test-reports"}}
    )
    def test_intelligent_alerts_refresh_after_new_write(self):
        initial = intelligent_alerts(user=self.user, motorcycle=self.motorcycle)

        Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Troca urgente",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=100,
            reference_km=9800,
            is_active=True,
        )
        self.motorcycle.current_odometer_km = 10000
        self.motorcycle.save(update_fields=["current_odometer_km"])

        refreshed = intelligent_alerts(user=self.user, motorcycle=self.motorcycle)

        self.assertGreater(len(refreshed), len(initial))
        self.assertTrue(any(alert.title == "Troca urgente" for alert in refreshed))

    def test_intelligent_alerts_query_count_is_bounded_across_motorcycles(self):
        for idx in range(3):
            motorcycle = Motorcycle.objects.create(
                owner=self.user,
                name=f"Moto Alert {idx}",
                brand="Honda",
                model="Biz",
                year=2020,
            )
            FuelRecord.objects.create(
                motorcycle=motorcycle,
                date="2026-04-10",
                odometer_km=1000,
                liters=Decimal("8.000"),
                total_price=Decimal("56.00"),
                price_per_liter=Decimal("7.000"),
                tank_full=True,
            )

        with CaptureQueriesContext(connection) as captured:
            intelligent_alerts(user=self.user)

        self.assertLessEqual(len(captured), 9)

    def test_sale_report_data_calculates_commercial_summary(self):
        preferred_station = FuelStation.objects.create(owner=self.user, name="Posto Alpha")
        other_station = FuelStation.objects.create(owner=self.user, name="Posto Beta")

        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            station=preferred_station,
            station_name="Posto Alpha",
            date="2026-04-14",
            odometer_km=10200,
            liters=Decimal("10.000"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            station=preferred_station,
            station_name="Posto Alpha",
            date="2026-04-15",
            odometer_km=10550,
            liters=Decimal("12.000"),
            total_price=Decimal("84.00"),
            price_per_liter=Decimal("7.000"),
        )
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            station=other_station,
            station_name="Posto Beta",
            date="2026-04-16",
            odometer_km=10900,
            liters=Decimal("9.000"),
            total_price=Decimal("63.00"),
            price_per_liter=Decimal("7.000"),
        )
        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            date="2026-04-17",
            odometer_km=10950,
            cost=Decimal("200.00"),
            workshop="Oficina Central",
        )
        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.REAR,
            brand_model="Pirelli Angel GT",
            installed_at="2026-04-11",
            installed_odometer_km=9900,
            cost=Decimal("800.00"),
            wear_percent=20,
            is_active=True,
        )
        TirePressureRecord.objects.create(
            motorcycle=self.motorcycle,
            date="2026-04-12",
            psi_front=32,
            psi_rear=36,
        )
        AnnualFee.objects.create(
            motorcycle=self.motorcycle,
            fee_type="ipva",
            year=2026,
            due_date="2026-05-01",
            amount=Decimal("300.00"),
        )
        InsurancePolicy.objects.create(
            motorcycle=self.motorcycle,
            provider="Seguradora Boa",
            coverage_start="2026-01-01",
            coverage_end="2026-12-31",
            premium=Decimal("1200.00"),
        )

        data = sale_report_data(motorcycle=self.motorcycle)

        self.assertEqual(data.motorcycle, self.motorcycle)
        self.assertEqual(data.fuel_summary.most_used_station.label, "Posto Alpha")
        self.assertEqual(data.fuel_summary.most_used_station.fillups_count, 2)
        self.assertEqual(data.fuel_summary.average_km_between_fillups, 300)
        self.assertEqual(data.summary.fuel, Decimal("287"))
        self.assertEqual(data.summary.maintenance, Decimal("350"))
        self.assertEqual(data.summary.tires, Decimal("800"))
        self.assertEqual(data.summary.annual_fees, Decimal("300"))
        self.assertEqual(data.summary.insurance, Decimal("1200"))
        self.assertTrue(any(row.type_label == "Troca de óleo" for row in data.maintenance_history))
        self.assertEqual(data.tire_history[0].brand_model, "Pirelli Angel GT")
        self.assertEqual(data.pressure_history[0].psi_front, 32)

    def test_sale_report_data_has_empty_state_for_sparse_records(self):
        empty_motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto vazia", brand="Honda", model="Biz", year=2020
        )

        data = sale_report_data(motorcycle=empty_motorcycle)

        self.assertIsNone(data.fuel_summary.most_used_station)
        self.assertIsNone(data.fuel_summary.average_km_between_fillups)
        self.assertEqual(data.fuel_summary.fillups_count, 0)
        self.assertEqual(data.summary.total, Decimal("0"))
        self.assertEqual(data.maintenance_history, [])
        self.assertEqual(data.tire_history, [])

    def test_sale_pdf_weasyprint_import_error(self):
        import sys
        self._grant_pro()
        self.client.force_login(self.user)
        # Simulate weasyprint not installed
        real_module = sys.modules.get("weasyprint")
        sys.modules["weasyprint"] = None
        try:
            with self.assertRaises(ImportError) as cm:
                self.client.get(reverse("reports:sale_report_pdf", args=[self.motorcycle.pk]))
            self.assertIn("weasyprint is required", str(cm.exception))
        finally:
            if real_module is not None:
                sys.modules["weasyprint"] = real_module
            else:
                sys.modules.pop("weasyprint", None)
