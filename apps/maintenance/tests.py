from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from apps.garage.models import Motorcycle
from apps.maintenance.forms import MaintenanceRecordQuickForm
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
        self.other_user = User.objects.create_user(
            username="other-user", email="other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(  # pylint: disable=no-member
            owner=self.user, name="Moto 1", brand="Honda", model="CB 300F", year=2024
        )
        Motorcycle.objects.create(  # pylint: disable=no-member
            owner=self.other_user, name="Moto 2", brand="Yamaha", model="MT-03", year=2024
        )
        self.part = MaintenancePart.objects.create(  # pylint: disable=no-member
            owner=self.user, name="Filtro de óleo", part_type=MaintenancePartType.FILTER
        )
        MaintenancePart.objects.create(
            owner=self.other_user, name="Pastilha", part_type=MaintenancePartType.BRAKE_PAD
        )  # pylint: disable=no-member

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

        self.assertEqual(list(form.fields["motorcycle"].queryset), [self.motorcycle])
        self.assertEqual(list(form.fields["parts"].queryset), [self.part])

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
            MaintenanceRecordPart.objects.get_or_create(
                maintenance_record=record, part=part
            )  # pylint: disable=no-member

        self.assertTrue(
            MaintenanceRecordPart.objects.filter(
                maintenance_record=record, part=self.part
            ).exists()  # pylint: disable=no-member
        )

    def test_catalog_view_only_shows_owned_parts(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:catalogs"))

        self.assertContains(response, "Filtro de óleo")
        self.assertNotContains(response, "Pastilha")

    def test_quick_create_invalid_htmx_returns_form_error_response(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("maintenance:quick_create"), {}, HTTP_HX_REQUEST="true", HTTP_HOST="localhost"
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("Registrar manutenção", response.content.decode())

    def test_maintenance_plan_item_shows_on_list(self):
        MaintenancePlanItem.objects.create(  # pylint: disable=no-member
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.OIL_CHANGE,
            interval_km=1000,
            last_done_km=0,
            is_active=True,
        )
        self.client.force_login(self.user)
        response = self.client.get(reverse("maintenance:list"), HTTP_HOST="localhost")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Plano de manutenção")
