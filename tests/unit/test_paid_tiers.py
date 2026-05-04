from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.documents.models import DocumentType, MotorcycleDocument
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.reminders.models import Reminder, TriggerType


class PaidTierEntitlementTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="tier-user", email="tier@example.com", password="pass12345")

    def test_free_plan_allows_one_active_motorcycle_and_pro_allows_more(self):
        from apps.billing.entitlements import can_add_active_motorcycle, has_pro_access
        from apps.billing.models import BillingPlan, SubscriptionProfile

        self.assertFalse(has_pro_access(self.user))
        self.assertTrue(can_add_active_motorcycle(self.user))

        Motorcycle.objects.create(owner=self.user, name="Moto 1", brand="Honda", model="CG", year=2024)

        self.assertFalse(can_add_active_motorcycle(self.user))

        SubscriptionProfile.objects.create(
            user=self.user,
            plan=BillingPlan.PRO,
            stripe_subscription_status="active",
            current_period_end=timezone.now() + timedelta(days=30),
        )

        self.assertTrue(has_pro_access(self.user))
        self.assertTrue(can_add_active_motorcycle(self.user))

    def test_free_upload_limit_counts_documents_fuel_receipts_and_maintenance_photos(self):
        from apps.billing.entitlements import FREE_UPLOAD_LIMIT, can_add_uploads
        from apps.maintenance.models import MaintenancePhoto, MaintenanceRecord

        motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto 1", brand="Honda", model="CG", year=2024)
        MotorcycleDocument.objects.create(
            motorcycle=motorcycle,
            name="CRLV",
            document_type=DocumentType.CRLV,
            file=SimpleUploadedFile("crlv.pdf", b"pdf", content_type="application/pdf"),
        )
        FuelRecord.objects.create(
            motorcycle=motorcycle,
            date=date(2026, 5, 1),
            odometer_km=1000,
            liters=Decimal("5.000"),
            total_price=Decimal("35.00"),
            price_per_liter=Decimal("7.000"),
            receipt_file=SimpleUploadedFile("recibo.pdf", b"pdf", content_type="application/pdf"),
        )
        record = MaintenanceRecord.objects.create(
            motorcycle=motorcycle,
            date=date(2026, 5, 2),
            odometer_km=1100,
            cost=Decimal("80.00"),
        )
        MaintenancePhoto.objects.create(
            maintenance_record=record,
            image=SimpleUploadedFile("foto.jpg", b"image", content_type="image/jpeg"),
        )

        self.assertEqual(FREE_UPLOAD_LIMIT, 3)
        self.assertFalse(can_add_uploads(self.user))


@override_settings(
    STRIPE_SECRET_KEY="sk_test_123",
    STRIPE_PRO_MONTHLY_PRICE_ID="price_monthly",
    STRIPE_PRO_YEARLY_PRICE_ID="price_yearly",
    STRIPE_PAYMENT_METHOD_TYPES=["pix", "card"],
)
class BillingFlowTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="billing-user", email="billing@example.com", password="pass12345")

    def test_checkout_view_creates_pix_first_subscription_session(self):
        self.client.force_login(self.user)
        created_payload = {}

        def fake_create(**kwargs):
            created_payload.update(kwargs)
            return SimpleNamespace(id="cs_test", url="https://checkout.stripe.test/session")

        fake_stripe = SimpleNamespace(
            checkout=SimpleNamespace(
                Session=SimpleNamespace(
                    create=fake_create
                )
            )
        )

        with patch("apps.billing.stripe_client.get_stripe_client", return_value=fake_stripe) as _stripe:
            response = self.client.post(reverse("billing:checkout"), {"interval": "monthly"})

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://checkout.stripe.test/session")
        self.assertEqual(created_payload["mode"], "subscription")
        self.assertEqual(created_payload["line_items"][0]["price"], "price_monthly")
        self.assertEqual(created_payload["payment_method_types"], ["pix", "card"])

    @override_settings(STRIPE_WEBHOOK_SECRET="")
    def test_stripe_webhook_accepts_valid_json_without_secret(self):
        with patch("apps.billing.views.process_stripe_event") as process_event:
            response = self.client.post(
                reverse("billing:stripe_webhook"),
                data='{"id":"evt_test","type":"invoice.paid","data":{"object":{}}}',
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        process_event.assert_called_once()

    @override_settings(STRIPE_WEBHOOK_SECRET="")
    def test_stripe_webhook_does_not_expose_exception_details(self):
        with patch("apps.billing.views.process_stripe_event", side_effect=RuntimeError("database stack detail")):
            response = self.client.post(
                reverse("billing:stripe_webhook"),
                data='{"id":"evt_bad","type":"invoice.paid","data":{"object":{}}}',
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content, b"Invalid webhook payload.")
        self.assertNotContains(response, "database stack detail", status_code=400)

    def test_subscription_webhook_activates_pro_idempotently(self):
        from apps.billing.models import BillingEvent, BillingPlan, SubscriptionProfile
        from apps.billing.webhooks import process_stripe_event

        event = {
            "id": "evt_sub_updated",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_123",
                    "customer": "cus_123",
                    "status": "active",
                    "cancel_at_period_end": False,
                    "current_period_end": int((timezone.now() + timedelta(days=30)).timestamp()),
                    "metadata": {"user_id": str(self.user.pk)},
                    "items": {"data": [{"price": {"id": "price_monthly", "recurring": {"interval": "month"}}}]},
                }
            },
        }

        process_stripe_event(event)
        process_stripe_event(event)

        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.plan, BillingPlan.PRO)
        self.assertEqual(profile.stripe_subscription_id, "sub_123")
        self.assertEqual(BillingEvent.objects.filter(stripe_event_id="evt_sub_updated").count(), 1)

    def test_invoice_payment_failed_keeps_three_day_grace(self):
        from apps.billing.entitlements import has_pro_access
        from apps.billing.models import BillingPlan, SubscriptionProfile
        from apps.billing.webhooks import process_stripe_event

        SubscriptionProfile.objects.create(
            user=self.user,
            plan=BillingPlan.PRO,
            stripe_customer_id="cus_123",
            stripe_subscription_id="sub_123",
            stripe_subscription_status="active",
        )
        process_stripe_event(
            {
                "id": "evt_failed",
                "type": "invoice.payment_failed",
                "data": {"object": {"customer": "cus_123", "subscription": "sub_123"}},
            }
        )

        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertEqual(profile.plan, BillingPlan.PRO)
        self.assertTrue(profile.grace_until > timezone.now())
        self.assertTrue(has_pro_access(self.user))

    def test_invoice_paid_without_subscription_does_not_grant_pro(self):
        from apps.billing.entitlements import has_pro_access
        from apps.billing.models import SubscriptionProfile
        from apps.billing.webhooks import process_stripe_event

        SubscriptionProfile.objects.create(
            user=self.user,
            stripe_customer_id="cus_123",
            stripe_subscription_status="",
        )
        process_stripe_event(
            {
                "id": "evt_paid_no_subscription",
                "type": "invoice.paid",
                "data": {"object": {"customer": "cus_123", "subscription": None}},
            }
        )

        profile = SubscriptionProfile.objects.get(user=self.user)
        self.assertFalse(has_pro_access(self.user))
        self.assertEqual(profile.stripe_subscription_status, "")


class WorkSessionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="work-user", email="work@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto Trabalho",
            brand="Honda",
            model="CG 160",
            year=2025,
        )

    def test_professional_summary_calculates_profit_per_hour_and_km(self):
        from apps.work.models import PlatformSource, ProfessionalCostSettings, WorkSession
        from apps.work.services import professional_summary

        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 5, 3),
            odometer_km=10100,
            liters=Decimal("5.000"),
            total_price=Decimal("20.00"),
            price_per_liter=Decimal("4.000"),
        )
        ProfessionalCostSettings.objects.create(
            motorcycle=self.motorcycle,
            maintenance_reserve_per_km=Decimal("0.12"),
            depreciation_per_km=Decimal("0.05"),
            fixed_daily_cost=Decimal("10.00"),
        )
        WorkSession.objects.create(
            owner=self.user,
            motorcycle=self.motorcycle,
            work_date=date(2026, 5, 3),
            started_at=datetime(2026, 5, 3, 8, 0, tzinfo=timezone.get_current_timezone()),
            ended_at=datetime(2026, 5, 3, 16, 0, tzinfo=timezone.get_current_timezone()),
            odometer_start_km=10000,
            odometer_end_km=10100,
            gross_income=Decimal("200.00"),
            tips=Decimal("5.00"),
            platform_source=PlatformSource.IFOOD,
        )

        summary = professional_summary(
            user=self.user,
            motorcycle=self.motorcycle,
            start=date(2026, 5, 1),
            end=date(2026, 5, 31),
        )

        self.assertEqual(summary.revenue, Decimal("205.00"))
        self.assertEqual(summary.fuel_cost, Decimal("20.00"))
        self.assertEqual(summary.maintenance_reserve, Decimal("12.00"))
        self.assertEqual(summary.depreciation_cost, Decimal("5.00"))
        self.assertEqual(summary.fixed_cost, Decimal("10.00"))
        self.assertEqual(summary.estimated_profit, Decimal("158.00"))
        self.assertEqual(summary.profit_per_km, Decimal("1.580"))
        self.assertEqual(summary.profit_per_hour, Decimal("19.750"))

    def test_work_session_form_renders_datetime_local_values(self):
        from apps.work.forms import WorkSessionForm
        from apps.work.models import PlatformSource, WorkSession

        session = WorkSession.objects.create(
            owner=self.user,
            motorcycle=self.motorcycle,
            work_date=date(2026, 5, 3),
            started_at=datetime(2026, 5, 3, 8, 0, tzinfo=timezone.get_current_timezone()),
            ended_at=datetime(2026, 5, 3, 16, 0, tzinfo=timezone.get_current_timezone()),
            odometer_start_km=10000,
            odometer_end_km=10100,
            gross_income=Decimal("200.00"),
            platform_source=PlatformSource.IFOOD,
        )

        form = WorkSessionForm(user=self.user, instance=session)

        self.assertIn('value="2026-05-03T08:00"', str(form["started_at"]))
        self.assertIn('value="2026-05-03T16:00"', str(form["ended_at"]))


class PaidTierGateTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="gate-user", email="gate@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto 1", brand="Honda", model="CG", year=2024)

    def test_free_user_cannot_create_second_active_motorcycle(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("garage:create"),
            {"name": "Moto 2", "brand": "Yamaha", "model": "Factor", "year": 2023},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Plano Pro")
        self.assertEqual(Motorcycle.objects.filter(owner=self.user, is_active=True).count(), 1)

    def test_free_user_fuel_logging_keeps_record_but_drops_receipt_after_upload_limit(self):
        for idx in range(3):
            MotorcycleDocument.objects.create(
                motorcycle=self.motorcycle,
                name=f"Doc {idx}",
                document_type=DocumentType.OTHER,
                file=SimpleUploadedFile(f"doc-{idx}.pdf", b"pdf", content_type="application/pdf"),
            )

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("fuel:quick_create"),
            {
                "motorcycle": self.motorcycle.pk,
                "date": "2026-05-03",
                "odometer_km": "1200",
                "liters": "5.000",
                "total_price_0": "35.00",
                "total_price_1": "BRL",
                "price_per_liter_0": "7.000",
                "price_per_liter_1": "BRL",
                "fuel_type": "gasoline",
                "tank_full": "on",
                "receipt_file": SimpleUploadedFile("recibo.pdf", b"pdf", content_type="application/pdf"),
            },
        )

        self.assertEqual(response.status_code, 302)
        record = FuelRecord.objects.get(motorcycle=self.motorcycle, odometer_km=1200)
        self.assertFalse(record.receipt_file)

    def test_free_user_cannot_export_advanced_reports(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("reports:export_detailed_csv"))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("pricing"), response["Location"])

    def test_free_user_can_create_only_three_active_reminders(self):
        for idx in range(3):
            Reminder.objects.create(
                motorcycle=self.motorcycle,
                title=f"Lembrete {idx}",
                trigger_type=TriggerType.BY_KM,
                trigger_value_km=1000,
                reference_km=1000,
                is_active=True,
            )

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("reminders:create"),
            {
                "motorcycle": self.motorcycle.pk,
                "title": "Lembrete 4",
                "trigger_type": TriggerType.BY_KM,
                "trigger_value_km": "1000",
                "reference_km": "2000",
                "is_active": "on",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Plano Pro")
        self.assertEqual(Reminder.objects.filter(motorcycle=self.motorcycle, is_active=True).count(), 3)
