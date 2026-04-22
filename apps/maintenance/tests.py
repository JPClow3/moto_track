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
            owner=self.user, name="Filtro de oleo", part_type=MaintenancePartType.FILTER
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

    def test_catalog_view_only_shows_owned_parts(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:catalogs"))

        self.assertContains(response, "Filtro de oleo")
        self.assertNotContains(response, "Pastilha")

    def test_quick_create_invalid_htmx_returns_form_error_response(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("maintenance:quick_create"), {}, HTTP_HX_REQUEST="true", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 422)
        self.assertIn("Registrar", response.content.decode())

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
