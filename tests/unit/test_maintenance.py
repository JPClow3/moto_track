from datetime import date
from decimal import Decimal
from typing import cast

from django import forms
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse

from apps.garage.models import Motorcycle
from apps.maintenance.forms import MaintenancePlanItemForm, MaintenanceRecordQuickForm
from apps.maintenance.models import (
    MaintenancePart,
    MaintenancePartType,
    MaintenancePlanItem,
    MaintenanceRecord,
    MaintenanceRecordPart,
    MaintenanceType,
)


class MaintenanceModelTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="maintenance-user", email="maintenance@example.com", password="pass12345"
        )
        self.other_user = User.objects.create_user(username="other-user", email="other@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto 1", brand="Honda", model="CB 300F", year=2024
        )
        Motorcycle.objects.create(owner=self.other_user, name="Moto 2", brand="Yamaha", model="MT-03", year=2024)
        self.part = MaintenancePart.objects.create(
            owner=self.user,
            name="Filtro de oleo",
            part_type=MaintenancePartType.FILTER,
            track_stock=True,
            stock_quantity=3,
            low_stock_threshold=1,
        )
        MaintenancePart.objects.create(
            owner=self.other_user, name="Pastilha", part_type=MaintenancePartType.BRAKE_PAD
        )

    def test_maintenance_record_clean_rejects_invalid_values(self):
        record = MaintenanceRecord(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 13),
            odometer_km=1000,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            cost=Decimal("-5.00"),
            interval_km=0,
            interval_days=0,
        )

        with self.assertRaises(ValidationError):
            record.full_clean()

    def test_quick_form_limits_querysets_to_owner(self):
        form = MaintenanceRecordQuickForm(user=self.user)
        motorcycle_field = cast(forms.ModelChoiceField, form.fields["motorcycle"])
        parts_field = cast(forms.ModelMultipleChoiceField, form.fields["parts"])

        self.assertEqual(list(motorcycle_field.queryset), [self.motorcycle])
        self.assertEqual(list(parts_field.queryset), [self.part])

    def test_quick_form_persists_selected_parts(self):
        form = MaintenanceRecordQuickForm(
            data={
                "motorcycle": self.motorcycle.pk,
                "maintenance_type": MaintenanceType.OIL_CHANGE,
                "date": "2026-04-13",
                "odometer_km": 1000,
                "cost_0": "50.00",
                "cost_1": "BRL",
                "parts": [self.part.pk],
            },
            user=self.user,
        )

        self.assertTrue(form.is_valid())
        record = form.save()
        for part in form.cleaned_data["parts"]:
            MaintenanceRecordPart.objects.get_or_create(maintenance_record=record, part=part)

        self.assertTrue(MaintenanceRecordPart.objects.filter(maintenance_record=record, part=self.part).exists())

    def test_quick_create_decrements_tracked_stock_with_quantity(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("maintenance:quick_create"),
            {
                "motorcycle": self.motorcycle.pk,
                "maintenance_type": MaintenanceType.OIL_CHANGE,
                "date": "2026-04-13",
                "odometer_km": 1000,
                "cost_0": "50.00",
                "cost_1": "BRL",
                "parts": [self.part.pk],
                f"part_quantity_{self.part.pk}": "2",
                "client_submission_id": "stock-token",
            },
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 302)
        self.part.refresh_from_db()
        self.assertEqual(self.part.stock_quantity, 1)
        record = MaintenanceRecord.objects.get(motorcycle=self.motorcycle, odometer_km=1000)
        row = MaintenanceRecordPart.objects.get(maintenance_record=record, part=self.part)
        self.assertEqual(row.quantity, 2)

    def test_quick_form_rejects_over_consumption_for_tracked_stock(self):
        form = MaintenanceRecordQuickForm(
            data={
                "motorcycle": self.motorcycle.pk,
                "maintenance_type": MaintenanceType.OIL_CHANGE,
                "date": "2026-04-13",
                "odometer_km": 1000,
                "cost_0": "50.00",
                "cost_1": "BRL",
                "parts": [self.part.pk],
                f"part_quantity_{self.part.pk}": "4",
            },
            user=self.user,
        )

        self.assertFalse(form.is_valid())
        self.assertIn("parts", form.errors)

    def test_catalog_view_only_shows_owned_parts(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:catalogs"))

        self.assertContains(response, "Filtro de oleo")
        self.assertNotContains(response, "Pastilha")

    def test_part_update_view_renders_existing_part(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:part_update", args=[self.part.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Editar Filtro de oleo")

    def test_quick_create_invalid_htmx_returns_form_error_response(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("maintenance:quick_create"), {}, HTTP_HX_REQUEST="true", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 422)
        self.assertIn("Registrar", response.content.decode())

    def test_quick_create_get_marks_form_for_offline_queue(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("maintenance:quick_create"), HTTP_HX_REQUEST="true", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-offline-queue="maintenance:quick_create"')
        self.assertContains(response, 'name="client_submission_id"')

    def test_quick_create_replay_with_same_client_submission_is_idempotent(self):
        ClientSubmission = self.motorcycle._meta.apps.get_model("core", "ClientSubmission")
        token = "maintenance-replay-token"
        payload = {
            "motorcycle": self.motorcycle.pk,
            "maintenance_type": MaintenanceType.OIL_CHANGE,
            "date": "2026-04-13",
            "odometer_km": 1000,
            "cost_0": "50.00",
            "cost_1": "BRL",
            "parts": [self.part.pk],
            "client_submission_id": token,
        }

        self.client.force_login(self.user)
        first = self.client.post(reverse("maintenance:quick_create"), payload, HTTP_HOST="localhost")
        second = self.client.post(reverse("maintenance:quick_create"), payload, HTTP_HOST="localhost")

        self.assertEqual(first.status_code, 302)
        self.assertEqual(second.status_code, 302)
        self.assertEqual(MaintenanceRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=1000).count(), 1)
        record = MaintenanceRecord.objects.get(motorcycle=self.motorcycle, odometer_km=1000)
        submission = ClientSubmission.objects.get(owner=self.user, token=token)
        self.assertEqual(submission.action, "maintenance:quick_create")
        self.assertEqual(submission.result_model, "maintenance.MaintenanceRecord")
        self.assertEqual(submission.result_pk, record.pk)

    def test_quick_create_replay_with_claimed_client_submission_skips_duplicate_side_effect(self):
        ClientSubmission = self.motorcycle._meta.apps.get_model("core", "ClientSubmission")
        token = "maintenance-claimed-token"
        ClientSubmission.objects.create(owner=self.user, token=token, action="maintenance:quick_create")
        payload = {
            "motorcycle": self.motorcycle.pk,
            "maintenance_type": MaintenanceType.OIL_CHANGE,
            "date": "2026-04-13",
            "odometer_km": 1000,
            "cost_0": "50.00",
            "cost_1": "BRL",
            "parts": [self.part.pk],
            "client_submission_id": token,
        }

        self.client.force_login(self.user)
        response = self.client.post(reverse("maintenance:quick_create"), payload, HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 302)
        self.assertFalse(MaintenanceRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=1000).exists())

    def test_maintenance_plan_item_shows_on_list(self):
        MaintenancePlanItem.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            interval_km=1000,
            last_done_km=0,
            is_active=True,
        )
        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:list"), HTTP_HOST="localhost")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Plano")

    def test_list_view_places_summary_after_cta_and_before_filters(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:list"), HTTP_HOST="localhost")
        body = response.content.decode()

        self.assertLess(body.index("Agendar ou registrar"), body.index("Resumo de manutenção"))
        self.assertLess(body.index("Resumo de manutenção"), body.index("Refinar histórico"))

    def test_plan_item_requires_interval_km_or_days(self):
        item = MaintenancePlanItem(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
        )

        with self.assertRaises(ValidationError):
            item.full_clean()

    def test_upcoming_tasks_use_interval_records_beyond_first_page(self):
        for idx in range(55):
            MaintenanceRecord.objects.create(
                motorcycle=self.motorcycle,
                maintenance_type=MaintenanceType.OTHER,
                date=date(2026, 4, 1),
                odometer_km=1000 + idx,
                cost=Decimal("0.00"),
            )
        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            date=date(2026, 1, 1),
            odometer_km=1000,
            cost=Decimal("0.00"),
            interval_km=100,
        )
        self.motorcycle.current_odometer_km = 1150
        self.motorcycle.save(update_fields=["current_odometer_km"])

        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:list"), HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            any(task["maintenance_type"] == MaintenanceType.OIL_CHANGE for task in response.context["upcoming_tasks"])
        )

    def test_upcoming_tasks_dedupe_plan_and_label_history_sources(self):
        MaintenancePlanItem.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            interval_km=1000,
            last_done_km=0,
            is_active=True,
        )
        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            date=date(2026, 1, 1),
            odometer_km=100,
            cost=Decimal("0.00"),
            interval_km=300,
        )
        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.CHAIN_SET,
            date=date(2026, 1, 1),
            odometer_km=100,
            cost=Decimal("0.00"),
            interval_km=300,
        )
        self.motorcycle.current_odometer_km = 200
        self.motorcycle.save(update_fields=["current_odometer_km"])

        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:list"), HTTP_HOST="localhost")
        tasks = response.context["upcoming_tasks"]
        oil_tasks = [task for task in tasks if task["maintenance_type"] == MaintenanceType.OIL_CHANGE]
        chain_tasks = [task for task in tasks if task["maintenance_type"] == MaintenanceType.CHAIN_SET]

        self.assertEqual(len(oil_tasks), 1)
        self.assertEqual(oil_tasks[0]["source"], "plan")
        self.assertEqual(oil_tasks[0]["source_label"], "Plano preventivo")
        self.assertEqual(chain_tasks[0]["source"], "history")
        self.assertEqual(chain_tasks[0]["source_label"], "Baseado no histórico")

    def test_upcoming_tasks_keeps_history_fallback_when_plan_has_no_baseline(self):
        MaintenancePlanItem.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            interval_km=1000,
            last_done_km=None,
            last_done_date=None,
            is_active=True,
        )
        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            date=date(2026, 1, 1),
            odometer_km=100,
            cost=Decimal("0.00"),
            interval_km=300,
        )
        self.motorcycle.current_odometer_km = 200
        self.motorcycle.save(update_fields=["current_odometer_km"])

        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:list"), HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        oil_tasks = [task for task in response.context["upcoming_tasks"] if task["maintenance_type"] == MaintenanceType.OIL_CHANGE]
        self.assertEqual(len(oil_tasks), 1)
        self.assertEqual(oil_tasks[0]["source"], "history")
        self.assertEqual(oil_tasks[0]["source_label"], "Baseado no histórico")

    def test_plan_item_allows_normal_and_severe_for_same_type(self):
        MaintenancePlanItem.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            interval_km=1000,
            is_severe_duty_override=False,
            is_active=True,
        )
        MaintenancePlanItem.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            interval_km=700,
            is_severe_duty_override=True,
            is_active=True,
        )

        self.assertEqual(
            MaintenancePlanItem.objects.filter(
                motorcycle=self.motorcycle,
                maintenance_type=MaintenanceType.OIL_CHANGE,
            ).count(),
            2,
        )

    def test_plan_item_rejects_duplicate_same_type_and_severity(self):
        MaintenancePlanItem.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            interval_km=1000,
            is_severe_duty_override=False,
            is_active=True,
        )
        with self.assertRaises(IntegrityError):
            MaintenancePlanItem.objects.create(
                motorcycle=self.motorcycle,
                maintenance_type=MaintenanceType.OIL_CHANGE,
                interval_km=900,
                is_severe_duty_override=False,
                is_active=True,
            )

    def test_plan_item_form_limits_motorcycles_to_owner(self):
        form = MaintenancePlanItemForm(user=self.user)
        motorcycle_field = cast(forms.ModelChoiceField, form.fields["motorcycle"])

        self.assertEqual(list(motorcycle_field.queryset), [self.motorcycle])

    def test_plan_item_crud_is_owner_scoped(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("maintenance:plan_create"),
            {
                "motorcycle": self.motorcycle.pk,
                "maintenance_type": MaintenanceType.OIL_FILTER,
                "interval_km": 5000,
                "interval_days": 180,
                "last_done_km": 1000,
                "last_done_date": "2026-01-01",
                "is_active": True,
            },
        )

        self.assertEqual(response.status_code, 302)
        item = MaintenancePlanItem.objects.get(motorcycle=self.motorcycle, maintenance_type=MaintenanceType.OIL_FILTER)
        self.assertEqual(item.interval_km, 5000)

        response = self.client.post(
            reverse("maintenance:plan_update", args=[item.pk]),
            {
                "motorcycle": self.motorcycle.pk,
                "maintenance_type": MaintenanceType.OIL_FILTER,
                "interval_km": 6000,
                "interval_days": 180,
                "last_done_km": 1000,
                "last_done_date": "2026-01-01",
                "is_active": True,
            },
        )
        self.assertEqual(response.status_code, 302)
        item.refresh_from_db()
        self.assertEqual(item.interval_km, 6000)

        response = self.client.post(reverse("maintenance:plan_delete", args=[item.pk]))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(MaintenancePlanItem.objects.filter(pk=item.pk).exists())

    def test_model_clean_rejects_odometer_regression_from_fuel(self):
        """A maintenance record with odometer lower than a prior fuel record must fail full_clean."""
        from apps.fuel.models import FuelRecord

        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 10),
            odometer_km=5000,
            liters=Decimal("10.0"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        bad = MaintenanceRecord(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 12),
            odometer_km=4500,
            maintenance_type=MaintenanceType.REVIEW,
            cost=Decimal("0.00"),
        )
        with self.assertRaises(ValidationError) as cm:
            bad.full_clean()
        self.assertIn("odometer_km", cm.exception.message_dict)

    def test_model_save_rejects_odometer_regression_from_tires(self):
        """A maintenance record with odometer lower than a prior tire record must fail on save."""
        from apps.tires.models import TirePosition, TireRecord

        TireRecord.objects.create(
            motorcycle=self.motorcycle,
            position=TirePosition.FRONT,
            brand_model="Pirelli Diablo",
            installed_at=date(2026, 4, 5),
            installed_odometer_km=6000,
            cost=Decimal("0.00"),
        )
        bad = MaintenanceRecord(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 10),
            odometer_km=5500,
            maintenance_type=MaintenanceType.CHAIN_SET,
            cost=Decimal("0.00"),
        )
        with self.assertRaises(ValidationError) as cm:
            bad.save()
        self.assertIn("odometer_km", cm.exception.message_dict)
