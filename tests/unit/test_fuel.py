import shutil
import tempfile
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, cast

from django import forms
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse

from apps.documents.models import DocumentType, MotorcycleDocument
from apps.fuel.forms import FuelRecordQuickForm
from apps.fuel.models import FuelGrade, FuelPreference, FuelRecord, FuelReviewPreference, FuelStation, FuelType
from apps.fuel.services import (
    build_fuel_period_summary,
    compute_average_consumption_km_per_liter,
    estimate_next_fill_up,
    monthly_fuel_trend,
    remember_fuel_preference,
    review_suggestion_for_motorcycle,
)
from apps.garage.models import Motorcycle
from apps.reports.services import intelligent_alerts


class FuelModelTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media_root = tempfile.mkdtemp()
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="fuel-user", email="fuel@example.com", password="pass12345")
        self.other_user = User.objects.create_user(
            username="other-user", email="other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(  # pylint: disable=no-member
            owner=self.user, name="Moto 1", brand="Honda", model="CB 300F", year=2024
        )
        Motorcycle.objects.create(  # pylint: disable=no-member
            owner=self.other_user, name="Moto 2", brand="Yamaha", model="MT-03", year=2024
        )
        self.station = FuelStation.objects.create(owner=self.user, name="Posto A")  # pylint: disable=no-member
        FuelStation.objects.create(owner=self.other_user, name="Posto B")  # pylint: disable=no-member
        self.grade = FuelGrade.objects.create(  # pylint: disable=no-member
            owner=self.user, name="Gasolina premium", fuel_type=FuelType.PREMIUM_GASOLINE
        )
        FuelGrade.objects.create(
            owner=self.other_user, name="Etanol", fuel_type=FuelType.ETHANOL
        )  # pylint: disable=no-member

    def _fuel_payload(self, **overrides):
        payload = {
            "motorcycle": self.motorcycle.pk,
            "station": self.station.pk,
            "fuel_grade": self.grade.pk,
            "date": "2026-04-13",
            "odometer_km": 1000,
            "liters": "10.000",
            "total_price_0": "70.00",
            "total_price_1": "BRL",
            "price_per_liter_0": "7.000",
            "price_per_liter_1": "BRL",
            "fuel_type": FuelType.PREMIUM_GASOLINE,
            "tank_full": True,
            "station_name": "Posto A",
            "notes": "Viagem curta",
        }
        payload.update(overrides)
        return payload

    def _create_record(self, **overrides):
        defaults = {
            "motorcycle": self.motorcycle,
            "station": self.station,
            "fuel_grade": self.grade,
            "date": date(2026, 4, 13),
            "odometer_km": 1000,
            "liters": Decimal("10.000"),
            "total_price": Decimal("70.00"),
            "price_per_liter": Decimal("7.000"),
            "fuel_type": FuelType.PREMIUM_GASOLINE,
            "tank_full": True,
            "station_name": "Posto A",
        }
        defaults.update(overrides)
        return FuelRecord.objects.create(**defaults)  # pylint: disable=no-member

    def test_fuel_record_clean_rejects_invalid_values(self):
        record = FuelRecord(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 13),
            odometer_km=1000,
            liters=Decimal("0"),
            total_price=Decimal("-1.00"),
            price_per_liter=Decimal("0"),
        )

        with self.assertRaises(ValidationError):
            record.full_clean()

    def test_fuel_record_clean_reports_field_specific_messages(self):
        record = FuelRecord(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 13),
            odometer_km=1000,
            liters=Decimal("0"),
            total_price=Decimal("-1.00"),
            price_per_liter=Decimal("0"),
        )

        with self.assertRaises(ValidationError) as ctx:
            record.full_clean()

        errors = ctx.exception.message_dict
        self.assertEqual(errors["liters"], ["A quantidade de litros deve ser maior que zero."])
        self.assertEqual(errors["total_price"], ["O valor total não pode ser negativo."])
        self.assertEqual(errors["price_per_liter"], ["O preço por litro deve ser maior que zero."])

    def test_quick_form_accepts_valid_fill_up_and_calculates_price_per_liter(self):
        form = FuelRecordQuickForm(
            data=self._fuel_payload(price_per_liter_0="", price_per_liter_1="BRL"),
            user=self.user,
        )

        self.assertTrue(form.is_valid(), form.errors)
        record = form.save()

        self.assertEqual(record.motorcycle, self.motorcycle)
        self.assertEqual(record.station, self.station)
        self.assertEqual(record.fuel_grade, self.grade)
        self.assertEqual(record.price_per_liter.amount, Decimal("7.000"))
        self.assertEqual(record.notes, "Viagem curta")

    def test_quick_form_accepts_receipt_upload(self):
        receipt = SimpleUploadedFile("cupom.pdf", b"%PDF-1.4\n", content_type="application/pdf")
        form = FuelRecordQuickForm(data=self._fuel_payload(), files={"receipt_file": receipt}, user=self.user)

        self.assertTrue(form.is_valid(), form.errors)
        record = form.save()

        self.assertTrue(record.receipt_file.name.startswith("fuel/receipts/"))
        self.assertTrue(record.receipt_file.name.endswith(".pdf"))

    def test_quick_form_rejects_unsafe_receipt_upload(self):
        receipt = SimpleUploadedFile("cupom.exe", b"not a receipt", content_type="application/x-msdownload")
        form = FuelRecordQuickForm(data=self._fuel_payload(), files={"receipt_file": receipt}, user=self.user)

        self.assertFalse(form.is_valid())
        self.assertIn("comprovante", str(form.errors["receipt_file"]).lower())

    def test_quick_form_limits_querysets_to_owner(self):
        form = FuelRecordQuickForm(user=self.user)
        motorcycle_field = cast(forms.ModelChoiceField, form.fields["motorcycle"])
        station_field = cast(forms.ModelChoiceField, form.fields["station"])
        fuel_grade_field = cast(forms.ModelChoiceField, form.fields["fuel_grade"])

        self.assertEqual(list(motorcycle_field.queryset), [self.motorcycle])
        self.assertEqual(list(station_field.queryset), [self.station])
        self.assertEqual(list(fuel_grade_field.queryset), [self.grade])

    def test_quick_form_rejects_other_user_motorcycle_station_and_grade(self):
        other_motorcycle = Motorcycle.objects.get(owner=self.other_user)
        other_station = FuelStation.objects.get(owner=self.other_user)
        other_grade = FuelGrade.objects.get(owner=self.other_user)

        form = FuelRecordQuickForm(
            data=self._fuel_payload(
                motorcycle=other_motorcycle.pk,
                station=other_station.pk,
                fuel_grade=other_grade.pk,
            ),
            user=self.user,
        )

        self.assertFalse(form.is_valid())
        expected_message = "Faça uma escolha válida. Sua escolha não é uma das disponíveis."
        self.assertEqual(form.errors["motorcycle"], [expected_message])
        self.assertEqual(form.errors["station"], [expected_message])
        self.assertEqual(form.errors["fuel_grade"], [expected_message])

    def test_quick_form_blocks_duplicate_fill_up(self):
        self._create_record(tank_full=False)
        form = FuelRecordQuickForm(
            data=self._fuel_payload(),
            user=self.user,
        )

        self.assertFalse(form.is_valid())
        self.assertIn("Este abastecimento parece duplicado.", form.non_field_errors())

    def test_quick_form_blocks_odometer_regression(self):
        self._create_record(date=date(2026, 4, 10), odometer_km=2000)
        form = FuelRecordQuickForm(
            data=self._fuel_payload(date="2026-04-12", odometer_km=1500, liters="8.000", total_price_0="56.00"),
            user=self.user,
        )

        self.assertFalse(form.is_valid())
        self.assertEqual(
            form.errors["odometer_km"],
            ["Existe um evento anterior com odômetro maior que este valor."],
        )

    def test_quick_form_rejects_future_date_with_clear_message(self):
        form = FuelRecordQuickForm(
            data=self._fuel_payload(date="2999-01-01"),
            user=self.user,
        )

        self.assertFalse(form.is_valid())
        self.assertEqual(form.errors["date"], ["A data não pode estar no futuro."])

    def test_quick_form_accepts_high_odometer_and_three_decimal_liters(self):
        form = FuelRecordQuickForm(
            data=self._fuel_payload(
                odometer_km=999999,
                liters="12.345",
                total_price_0="86.42",
                price_per_liter_0="7.000",
            ),
            user=self.user,
        )

        self.assertTrue(form.is_valid(), form.errors)
        record = form.save()
        self.assertEqual(record.odometer_km, 999999)
        self.assertEqual(record.liters, Decimal("12.345"))

    def test_remember_fuel_preference_updates_last_pattern(self):
        record = self._create_record()
        preference = remember_fuel_preference(record)

        self.assertEqual(preference.use_count, 1)
        self.assertTrue(FuelPreference.objects.filter(owner=self.user, station=self.station).exists())

    def test_remember_fuel_preference_reuses_pattern_and_updates_values(self):
        first = self._create_record(odometer_km=1000, price_per_liter=Decimal("7.000"), tank_full=True)
        second = self._create_record(
            date=date(2026, 4, 14),
            odometer_km=1100,
            price_per_liter=Decimal("7.250"),
            total_price=Decimal("72.50"),
            tank_full=False,
        )

        first_preference = remember_fuel_preference(first)
        second_preference = remember_fuel_preference(second)
        first_preference.refresh_from_db()

        self.assertEqual(first_preference.pk, second_preference.pk)
        self.assertEqual(FuelPreference.objects.filter(owner=self.user).count(), 1)
        self.assertEqual(second_preference.use_count, 2)
        self.assertEqual(second_preference.price_per_liter.amount, Decimal("7.250"))
        self.assertFalse(second_preference.tank_full)

    def test_fuel_preference_unique_constraint_blocks_duplicate_pattern(self):
        FuelPreference.objects.create(  # pylint: disable=no-member
            owner=self.user,
            motorcycle=self.motorcycle,
            station=self.station,
            fuel_grade=self.grade,
            fuel_type=FuelType.PREMIUM_GASOLINE,
            station_name="Posto A",
            price_per_liter=Decimal("7.000"),
            tank_full=True,
            use_count=1,
        )
        with self.assertRaises(IntegrityError):
            FuelPreference.objects.create(  # pylint: disable=no-member
                owner=self.user,
                motorcycle=self.motorcycle,
                station=self.station,
                fuel_grade=self.grade,
                fuel_type=FuelType.PREMIUM_GASOLINE,
                station_name="Posto A",
                price_per_liter=Decimal("7.500"),
                tank_full=False,
                use_count=1,
            )

    def test_catalog_view_only_shows_owned_catalogs(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("fuel:catalogs"))

        self.assertContains(response, "Posto A")
        self.assertNotContains(response, "Posto B")
        self.assertContains(response, "Gasolina premium")
        self.assertNotContains(response, "Etanol")

    def test_list_view_only_shows_owned_records_and_filters_by_motorcycle(self):
        other_motorcycle = Motorcycle.objects.get(owner=self.other_user)
        other_station = FuelStation.objects.get(owner=self.other_user)
        visible = self._create_record(station_name="Posto visivel", odometer_km=1000)
        self._create_record(station_name="Posto filtrado", odometer_km=1200, date=date(2026, 4, 14))
        FuelRecord.objects.create(  # pylint: disable=no-member
            motorcycle=other_motorcycle,
            station=other_station,
            date=date(2026, 4, 13),
            odometer_km=5000,
            liters=Decimal("8.000"),
            total_price=Decimal("48.00"),
            price_per_liter=Decimal("6.000"),
            station_name="Posto secreto",
        )

        self.client.force_login(self.user)
        response = self.client.get(reverse("fuel:list"), {"motorcycle": self.motorcycle.pk})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Posto visivel")
        self.assertContains(response, "Posto filtrado")
        self.assertNotContains(response, "Posto secreto")
        self.assertContains(response, reverse("fuel:update", args=[visible.pk]))
        self.assertContains(response, reverse("fuel:delete", args=[visible.pk]))

    def test_list_view_filters_by_period_station_and_fuel_type(self):
        other_station = FuelStation.objects.create(owner=self.user, name="Posto C")  # pylint: disable=no-member
        self._create_record(station_name="Posto visivel", date=date(2026, 4, 10), fuel_type=FuelType.PREMIUM_GASOLINE)
        self._create_record(
            station=other_station,
            station_name="Posto C",
            date=date(2026, 4, 12),
            odometer_km=1300,
            fuel_type=FuelType.ETHANOL,
        )
        self._create_record(
            station_name="Fora do periodo",
            date=date(2026, 3, 1),
            odometer_km=900,
            fuel_type=FuelType.PREMIUM_GASOLINE,
        )

        self.client.force_login(self.user)
        response = self.client.get(
            reverse("fuel:list"),
            {
                "start": "2026-04-01",
                "end": "2026-04-30",
                "station": self.station.pk,
                "fuel_type": FuelType.PREMIUM_GASOLINE,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Posto visivel")
        self.assertNotIn(">Posto C</span>", response.content.decode())
        self.assertNotContains(response, "Fora do periodo")

    def test_defaults_view_returns_only_current_user_preference(self):
        preference = remember_fuel_preference(self._create_record(price_per_liter=Decimal("7.111"), tank_full=False))
        other_motorcycle = Motorcycle.objects.get(owner=self.other_user)
        other_station = FuelStation.objects.get(owner=self.other_user)
        FuelPreference.objects.create(  # pylint: disable=no-member
            owner=self.other_user,
            motorcycle=other_motorcycle,
            station=other_station,
            fuel_type=FuelType.GASOLINE,
            station_name="Posto secreto",
            price_per_liter=Decimal("5.123"),
            tank_full=True,
            use_count=99,
        )

        self.client.force_login(self.user)
        response = self.client.get(
            reverse("fuel:defaults"),
            {"station": preference.station_id, "fuel_grade": preference.fuel_grade_id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "price_per_liter": "7.111",
                "tank_full": False,
                "station_name": "Posto A",
            },
        )

    def test_quick_create_invalid_htmx_returns_form_error_response(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("fuel:quick_create"), {}, HTTP_HX_REQUEST="true", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 422)
        self.assertIn("Adicionar abastecimento", response.content.decode())

    def test_quick_create_invalid_htmx_marks_required_fields_and_errors(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("fuel:quick_create"), {}, HTTP_HX_REQUEST="true", HTTP_HOST="localhost")
        html = response.content.decode()

        self.assertEqual(response.status_code, 422)
        self.assertIn('aria-required="true"', html)
        self.assertIn('aria-invalid="true"', html)
        self.assertIn("Este campo é obrigatório.", html)

    def test_quick_create_get_marks_required_fields_for_accessibility(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("fuel:quick_create"), HTTP_HX_REQUEST="true", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'aria-required="true"')
        self.assertContains(response, 'data-offline-queue="fuel:quick_create"')
        self.assertContains(response, 'name="client_submission_id"')

    def test_quick_create_uses_total_price_subfield_for_live_preview(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("fuel:quick_create"), HTTP_HX_REQUEST="true", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "document.querySelector('[name=total_price_0]')")
        self.assertContains(response, "$event.target.name === 'total_price_0'")
        self.assertNotContains(response, "document.getElementById('')")

    def test_quick_create_persists_record_and_preference_from_form_submission(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse("fuel:quick_create"),
            self._fuel_payload(next=reverse("fuel:list")),
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 302)
        record = FuelRecord.objects.get(motorcycle=self.motorcycle, odometer_km=1000)  # pylint: disable=no-member
        self.assertEqual(record.station, self.station)
        self.assertEqual(record.fuel_grade, self.grade)
        self.assertEqual(record.total_price.amount, Decimal("70.00"))
        self.assertTrue(record.tank_full)
        self.assertTrue(
            FuelPreference.objects.filter(
                owner=self.user,
                motorcycle=self.motorcycle,
                station=self.station,
                fuel_grade=self.grade,
                use_count=1,
            ).exists()
        )

    def test_quick_create_replay_with_same_client_submission_is_idempotent(self):
        ClientSubmission = self.motorcycle._meta.apps.get_model("core", "ClientSubmission")
        token = "fuel-replay-token"
        payload = self._fuel_payload(next=reverse("fuel:list"), client_submission_id=token)

        self.client.force_login(self.user)
        first = self.client.post(reverse("fuel:quick_create"), payload, HTTP_HOST="localhost")
        second = self.client.post(reverse("fuel:quick_create"), payload, HTTP_HOST="localhost")

        self.assertEqual(first.status_code, 302)
        self.assertEqual(second.status_code, 302)
        self.assertEqual(FuelRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=1000).count(), 1)
        record = FuelRecord.objects.get(motorcycle=self.motorcycle, odometer_km=1000)
        submission = ClientSubmission.objects.get(owner=self.user, token=token)
        self.assertEqual(submission.action, "fuel:quick_create")
        self.assertEqual(submission.result_model, "fuel.FuelRecord")
        self.assertEqual(submission.result_pk, record.pk)

    def test_quick_create_replay_with_claimed_client_submission_skips_duplicate_side_effect(self):
        ClientSubmission = self.motorcycle._meta.apps.get_model("core", "ClientSubmission")
        token = "fuel-claimed-token"
        ClientSubmission.objects.create(owner=self.user, token=token, action="fuel:quick_create")
        payload = self._fuel_payload(next=reverse("fuel:list"), client_submission_id=token)

        self.client.force_login(self.user)
        response = self.client.post(reverse("fuel:quick_create"), payload, HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 302)
        self.assertFalse(FuelRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=1000).exists())

    def test_quick_create_persists_receipt_from_form_submission(self):
        receipt = SimpleUploadedFile("cupom.jpg", b"fake image", content_type="image/jpeg")

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("fuel:quick_create"),
            {**self._fuel_payload(next=reverse("fuel:list")), "receipt_file": receipt},
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 302)
        record = FuelRecord.objects.get(motorcycle=self.motorcycle, odometer_km=1000)  # pylint: disable=no-member
        self.assertTrue(record.receipt_file.name.endswith(".jpg"))

    def test_quick_create_cannot_create_record_for_other_user_motorcycle(self):
        other_motorcycle = Motorcycle.objects.get(owner=self.other_user)

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("fuel:quick_create"),
            self._fuel_payload(motorcycle=other_motorcycle.pk),
            HTTP_HX_REQUEST="true",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(FuelRecord.objects.filter(motorcycle=other_motorcycle).exists())  # pylint: disable=no-member
        self.assertContains(response, "Faça uma escolha válida.", status_code=422)

    def test_record_update_view_updates_owned_record(self):
        record = self._create_record()

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("fuel:update", args=[record.pk]),
            self._fuel_payload(
                date="2026-04-14",
                odometer_km=1250,
                liters="11.500",
                total_price_0="80.50",
                price_per_liter_0="7.000",
                station_name="Posto atualizado",
                notes="Registro corrigido",
            ),
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 302)
        record.refresh_from_db()
        self.assertEqual(record.odometer_km, 1250)
        self.assertEqual(record.liters, Decimal("11.500"))
        self.assertEqual(record.total_price.amount, Decimal("80.50"))
        self.assertEqual(record.station_name, "Posto atualizado")
        self.assertEqual(record.notes, "Registro corrigido")

    def test_record_update_preserves_existing_receipt_when_upload_limit_blocks_new_file(self):
        record = self._create_record(
            receipt_file=SimpleUploadedFile("recibo-original.pdf", b"%PDF-1.4\n", content_type="application/pdf")
        )
        original_receipt = record.receipt_file.name
        for idx in range(2):
            MotorcycleDocument.objects.create(
                motorcycle=self.motorcycle,
                name=f"Doc limite {idx}",
                document_type=DocumentType.OTHER,
                file=SimpleUploadedFile(f"doc-limite-{idx}.pdf", b"pdf", content_type="application/pdf"),
            )

        self.client.force_login(self.user)
        response = self.client.post(
            reverse("fuel:update", args=[record.pk]),
            {
                **self._fuel_payload(
                    date="2026-04-14",
                    odometer_km=1250,
                    liters="11.500",
                    total_price_0="80.50",
                    price_per_liter_0="7.000",
                ),
                "receipt_file": SimpleUploadedFile("recibo-novo.pdf", b"%PDF-1.4\n", content_type="application/pdf"),
            },
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 302)
        record.refresh_from_db()
        self.assertEqual(record.receipt_file.name, original_receipt)

    def test_record_update_view_denies_other_user_record(self):
        other_motorcycle = Motorcycle.objects.get(owner=self.other_user)
        record = FuelRecord.objects.create(  # pylint: disable=no-member
            motorcycle=other_motorcycle,
            date=date(2026, 4, 13),
            odometer_km=5000,
            liters=Decimal("8.000"),
            total_price=Decimal("48.00"),
            price_per_liter=Decimal("6.000"),
            station_name="Posto secreto",
        )

        self.client.force_login(self.user)
        get_response = self.client.get(reverse("fuel:update", args=[record.pk]))
        post_response = self.client.post(
            reverse("fuel:update", args=[record.pk]),
            self._fuel_payload(station_name="Tentativa indevida"),
            HTTP_HOST="localhost",
        )

        self.assertEqual(get_response.status_code, 404)
        self.assertEqual(post_response.status_code, 404)
        record.refresh_from_db()
        self.assertEqual(record.station_name, "Posto secreto")

    def test_record_delete_view_removes_owned_record(self):
        record = self._create_record()

        self.client.force_login(self.user)
        response = self.client.post(reverse("fuel:delete", args=[record.pk]), HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 302)
        self.assertFalse(FuelRecord.objects.filter(pk=record.pk).exists())  # pylint: disable=no-member

    def test_record_delete_view_denies_other_user_record(self):
        other_motorcycle = Motorcycle.objects.get(owner=self.other_user)
        record = FuelRecord.objects.create(  # pylint: disable=no-member
            motorcycle=other_motorcycle,
            date=date(2026, 4, 13),
            odometer_km=5000,
            liters=Decimal("8.000"),
            total_price=Decimal("48.00"),
            price_per_liter=Decimal("6.000"),
            station_name="Posto secreto",
        )

        self.client.force_login(self.user)
        get_response = self.client.get(reverse("fuel:delete", args=[record.pk]))
        post_response = self.client.post(reverse("fuel:delete", args=[record.pk]), HTTP_HOST="localhost")

        self.assertEqual(get_response.status_code, 404)
        self.assertEqual(post_response.status_code, 404)
        self.assertTrue(FuelRecord.objects.filter(pk=record.pk).exists())  # pylint: disable=no-member

    def test_station_and_grade_update_delete_deny_other_user_catalogs(self):
        other_station = FuelStation.objects.get(owner=self.other_user)
        other_grade = FuelGrade.objects.get(owner=self.other_user)

        self.client.force_login(self.user)

        self.assertEqual(self.client.get(reverse("fuel:station_update", args=[other_station.pk])).status_code, 404)
        self.assertEqual(self.client.post(reverse("fuel:station_delete", args=[other_station.pk])).status_code, 404)
        self.assertEqual(self.client.get(reverse("fuel:grade_update", args=[other_grade.pk])).status_code, 404)
        self.assertEqual(self.client.post(reverse("fuel:grade_delete", args=[other_grade.pk])).status_code, 404)
        self.assertTrue(FuelStation.objects.filter(pk=other_station.pk).exists())  # pylint: disable=no-member
        self.assertTrue(FuelGrade.objects.filter(pk=other_grade.pk).exists())  # pylint: disable=no-member

    def test_repeat_last_opens_modal_and_creates_record(self):
        self._create_record(
            date=date(2026, 4, 1),
            odometer_km=100,
            liters=Decimal("10.0"),
        )

        self.client.force_login(self.user)
        response = self.client.get(reverse("fuel:repeat_last"), HTTP_HX_REQUEST="true", HTTP_HOST="localhost")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Repetir abastecimento", response.content.decode())
        self.assertContains(response, f'hx-post="{reverse("fuel:repeat_last")}"')

        post = self.client.post(
            reverse("fuel:repeat_last"),
            {
                "motorcycle": self.motorcycle.pk,
                "station": self.station.pk,
                "fuel_grade": self.grade.pk,
                "date": "2026-04-13",
                "odometer_km": 250,
                "liters": "8.0",
                "total_price_0": "60.00",
                "total_price_1": "BRL",
                "fuel_type": FuelType.PREMIUM_GASOLINE,
                "tank_full": True,
                "station_name": "Posto A",
                "notes": "",
            },
            HTTP_HX_REQUEST="true",
            HTTP_HOST="localhost",
        )
        self.assertEqual(post.status_code, 200)
        self.assertTrue(FuelRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=250).exists())  # pylint: disable=no-member

    def test_monthly_fuel_trend_zero_values_render_zero_bars(self):
        self._create_record(
            date=date(2026, 4, 1),
            odometer_km=100,
            liters=Decimal("0.001"),
            total_price=Decimal("0.01"),
            price_per_liter=Decimal("10.000"),
        )
        self._create_record(
            date=date(2026, 4, 2),
            odometer_km=200,
            liters=Decimal("0.001"),
            total_price=Decimal("0.01"),
            price_per_liter=Decimal("10.000"),
        )

        trend = monthly_fuel_trend(
            FuelRecord.objects.filter(motorcycle=self.motorcycle),  # pylint: disable=no-member
            today=date(2026, 4, 15),
        )

        current_point = trend["trend_points"][-1]
        self.assertTrue(current_point["has_value"])
        self.assertEqual(current_point["value"], 0.0)
        self.assertEqual(current_point["bar_percent"], 0)

    def test_compute_average_consumption_uses_full_tank_anchors(self):
        self._create_record(
            date=date(2026, 4, 1),
            odometer_km=0,
            liters=Decimal("10.0"),
            tank_full=True,
        )
        self._create_record(
            date=date(2026, 4, 5),
            odometer_km=120,
            liters=Decimal("3.0"),
            total_price=Decimal("21.00"),
            tank_full=False,
        )
        self._create_record(
            date=date(2026, 4, 10),
            odometer_km=300,
            liters=Decimal("12.0"),
            total_price=Decimal("84.00"),
            tank_full=True,
        )

        history = list(
            FuelRecord.objects.filter(motorcycle=self.motorcycle).order_by(  # pylint: disable=no-member
                "date", "odometer_km"
            )
        )
        stats = compute_average_consumption_km_per_liter(history)
        self.assertIsNotNone(stats)
        self.assertEqual(cast(Any, stats).km_per_liter, 20.0)
        self.assertEqual(cast(Any, stats).segments_used, 1)

    def test_compute_average_consumption_returns_none_without_two_full_tanks(self):
        self._create_record(date=date(2026, 4, 1), odometer_km=100, tank_full=True)
        self._create_record(date=date(2026, 4, 5), odometer_km=200, liters=Decimal("4.0"), tank_full=False)

        stats = compute_average_consumption_km_per_liter(
            FuelRecord.objects.filter(motorcycle=self.motorcycle)  # pylint: disable=no-member
        )

        self.assertIsNone(stats)

    def test_period_summary_keeps_official_and_provisional_partial_consumption(self):
        self._create_record(date=date(2026, 4, 1), odometer_km=0, liters=Decimal("10.0"), tank_full=True)
        self._create_record(
            date=date(2026, 4, 10),
            odometer_km=300,
            liters=Decimal("15.0"),
            total_price=Decimal("105.00"),
            tank_full=True,
        )
        self._create_record(
            date=date(2026, 4, 12),
            odometer_km=450,
            liters=Decimal("5.0"),
            total_price=Decimal("35.00"),
            tank_full=False,
        )

        summary = build_fuel_period_summary(FuelRecord.objects.filter(motorcycle=self.motorcycle))  # pylint: disable=no-member

        self.assertEqual(summary.official_consumption_km_l, 20.0)
        self.assertEqual(summary.provisional_consumption_km_l, 30.0)
        self.assertEqual(summary.total_liters, Decimal("30.000"))

    def test_next_fill_up_estimate_uses_full_tank_distance_average(self):
        self._create_record(date=date(2026, 4, 1), odometer_km=0, liters=Decimal("10.0"), tank_full=True)
        self._create_record(
            date=date(2026, 4, 10),
            odometer_km=300,
            liters=Decimal("15.0"),
            total_price=Decimal("105.00"),
            tank_full=True,
        )
        self._create_record(
            date=date(2026, 4, 12),
            odometer_km=450,
            liters=Decimal("5.0"),
            total_price=Decimal("35.00"),
            tank_full=False,
        )

        estimate = estimate_next_fill_up(FuelRecord.objects.filter(motorcycle=self.motorcycle))  # pylint: disable=no-member

        self.assertIsNotNone(estimate)
        self.assertEqual(cast(Any, estimate).recommended_odometer_km, 600)
        self.assertEqual(cast(Any, estimate).remaining_km, 150)

    def test_review_suggestion_uses_configurable_fillup_interval(self):
        FuelReviewPreference.objects.create(motorcycle=self.motorcycle, fillups_interval=3)  # pylint: disable=no-member
        for idx in range(3):
            self._create_record(date=date(2026, 4, idx + 1), odometer_km=1000 + idx * 100)

        suggestion = review_suggestion_for_motorcycle(self.motorcycle)

        self.assertTrue(suggestion.is_due)
        self.assertEqual(suggestion.fillups_since_review, 3)
        self.assertEqual(suggestion.interval, 3)

    def test_review_suggestion_excludes_same_day_same_or_lower_odometer_after_review(self):
        FuelReviewPreference.objects.create(motorcycle=self.motorcycle, fillups_interval=2)  # pylint: disable=no-member
        from apps.maintenance.models import MaintenanceRecord, MaintenanceType

        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            maintenance_type=MaintenanceType.REVIEW,
            date=date(2026, 4, 10),
            odometer_km=1000,
            cost=Decimal("0.00"),
        )
        self._create_record(date=date(2026, 4, 10), odometer_km=900)
        self._create_record(date=date(2026, 4, 10), odometer_km=1000, total_price=Decimal("71.00"))
        self._create_record(date=date(2026, 4, 10), odometer_km=1100, total_price=Decimal("72.00"))

        suggestion = review_suggestion_for_motorcycle(self.motorcycle)

        self.assertEqual(suggestion.fillups_since_review, 1)

    def test_intelligent_alerts_include_fuel_and_review_recommendations(self):
        FuelReviewPreference.objects.create(motorcycle=self.motorcycle, fillups_interval=2)  # pylint: disable=no-member
        self._create_record(date=date(2026, 4, 1), odometer_km=0, tank_full=True)
        self._create_record(date=date(2026, 4, 10), odometer_km=300, total_price=Decimal("105.00"), tank_full=True)
        self._create_record(date=date(2026, 4, 12), odometer_km=500, total_price=Decimal("35.00"), tank_full=False)

        alerts = intelligent_alerts(user=self.user, motorcycle=self.motorcycle)
        messages = [alert.message for alert in alerts]

        self.assertTrue(any("Próximo abastecimento" in message for message in messages))
        self.assertTrue(any("revisão" in message.lower() for message in messages))

    def test_fuel_export_csv_respects_filters_and_includes_receipt_column(self):
        from apps.billing.models import BillingPlan, SubscriptionProfile

        self._create_record(station_name="Posto visivel", date=date(2026, 4, 10), fuel_type=FuelType.PREMIUM_GASOLINE)
        self._create_record(station_name="Fora", date=date(2026, 3, 1), odometer_km=800, fuel_type=FuelType.ETHANOL)
        SubscriptionProfile.objects.create(
            user=self.user,
            plan=BillingPlan.PRO,
            stripe_subscription_status="active",
        )

        self.client.force_login(self.user)
        response = self.client.get(
            reverse("fuel:export"),
            {"format": "csv", "start": "2026-04-01", "end": "2026-04-30", "fuel_type": FuelType.PREMIUM_GASOLINE},
        )
        body = response.content.decode("utf-8-sig")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Comprovante", body)
        self.assertIn("Posto visivel", body)
        self.assertNotIn("Fora", body)

    def test_fuel_export_pdf_returns_pdf_response(self):
        from apps.billing.models import BillingPlan, SubscriptionProfile

        self._create_record(station_name="Posto PDF")
        SubscriptionProfile.objects.create(
            user=self.user,
            plan=BillingPlan.PRO,
            stripe_subscription_status="active",
        )

        self.client.force_login(self.user)
        response = self.client.get(reverse("fuel:export"), {"format": "pdf"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_fuel_import_preview_validates_without_creating_records(self):
        self.client.force_login(self.user)
        csv_file = SimpleUploadedFile(
            "fuel.csv",
            (
                b"date,odometer_km,liters,total_price,price_per_liter,fuel_type,tank_full,station_name\n"
                b"2026-04-20,1500,8.000,56.00,7.000,gasoline,true,Posto CSV\n"
            ),
            content_type="text/csv",
        )

        response = self.client.post(reverse("fuel:import_preview"), {"motorcycle": self.motorcycle.pk, "file": csv_file})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Posto CSV")
        self.assertFalse(FuelRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=1500).exists())

    def test_fuel_import_preview_rejects_invalid_liters_prices_and_odometer(self):
        self._create_record(date=date(2026, 4, 18), odometer_km=2000)
        self.client.force_login(self.user)
        csv_file = SimpleUploadedFile(
            "fuel.csv",
            (
                b"date,odometer_km,liters,total_price,price_per_liter,fuel_type,tank_full,station_name\n"
                b"2026-04-17,1500,0,-1.00,0,gasoline,true,Posto CSV\n"
            ),
            content_type="text/csv",
        )

        response = self.client.post(reverse("fuel:import_preview"), {"motorcycle": self.motorcycle.pk, "file": csv_file})

        self.assertEqual(response.status_code, 200)
        row = response.context["preview_rows"][0]
        self.assertFalse(row.is_valid)
        self.assertIn("maior que zero", " ".join(row.errors))
        self.assertFalse(FuelRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=1500).exists())

    def test_fuel_import_confirm_creates_previewed_rows(self):
        self.client.force_login(self.user)
        csv_file = SimpleUploadedFile(
            "fuel.csv",
            (
                b"date,odometer_km,liters,total_price,price_per_liter,fuel_type,tank_full,station_name\n"
                b"2026-04-20,1500,8.000,56.00,7.000,gasoline,true,Posto CSV\n"
            ),
            content_type="text/csv",
        )
        preview = self.client.post(reverse("fuel:import_preview"), {"motorcycle": self.motorcycle.pk, "file": csv_file})

        response = self.client.post(reverse("fuel:import_confirm"), {"import_token": preview.context["import_token"]})

        self.assertEqual(response.status_code, 302)
        self.assertTrue(FuelRecord.objects.filter(motorcycle=self.motorcycle, odometer_km=1500).exists())

    def test_fuel_import_confirm_rolls_back_tampered_invalid_session_rows(self):
        self.client.force_login(self.user)
        session = self.client.session
        session["fuel_imports"] = {
            "tampered": {
                "motorcycle_id": self.motorcycle.pk,
                "rows": [
                    {
                        "date": "2026-04-20",
                        "odometer_km": 1500,
                        "liters": "8.000",
                        "total_price": "56.00",
                        "price_per_liter": "7.000",
                        "fuel_type": FuelType.GASOLINE,
                        "tank_full": True,
                        "station_name": "Posto CSV",
                    },
                    {
                        "date": "2026-04-21",
                        "odometer_km": 1600,
                        "liters": "0",
                        "total_price": "0",
                        "price_per_liter": "0",
                        "fuel_type": FuelType.GASOLINE,
                        "tank_full": True,
                        "station_name": "Posto CSV",
                    },
                ],
            }
        }
        session.save()

        response = self.client.post(reverse("fuel:import_confirm"), {"import_token": "tampered"})

        self.assertEqual(response.status_code, 302)
        self.assertFalse(FuelRecord.objects.filter(motorcycle=self.motorcycle, odometer_km__in=[1500, 1600]).exists())

    def test_fuel_list_cost_per_km_uses_full_filtered_span_not_current_page(self):
        for idx in range(55):
            self._create_record(
                date=date(2026, 4, 1) + timedelta(days=idx),
                odometer_km=1000 + idx * 100,
                liters=Decimal("1.000"),
                total_price=Decimal("10.00"),
                price_per_liter=Decimal("10.000"),
            )

        self.client.force_login(self.user)
        response = self.client.get(reverse("fuel:list"), {"page": "2"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["avg_cost_per_km"], 0.102)

    def test_model_clean_rejects_odometer_regression_from_fuel(self):
        """A later fuel record with a lower odometer must fail full_clean."""
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 10),
            odometer_km=2000,
            liters=Decimal("10.0"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        bad = FuelRecord(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 12),
            odometer_km=1500,
            liters=Decimal("10.0"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        with self.assertRaises(ValidationError) as cm:
            bad.full_clean()
        self.assertIn("odometer_km", cm.exception.message_dict)

    def test_model_save_rejects_odometer_regression_from_maintenance(self):
        """A fuel record with odometer lower than a prior maintenance record must fail on save."""
        from apps.maintenance.models import MaintenanceRecord, MaintenanceType

        MaintenanceRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 5),
            odometer_km=3000,
            maintenance_type=MaintenanceType.REVIEW,
            cost=Decimal("0.00"),
        )
        bad = FuelRecord(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 10),
            odometer_km=2500,
            liters=Decimal("10.0"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        with self.assertRaises(ValidationError) as cm:
            bad.save()
        self.assertIn("odometer_km", cm.exception.message_dict)

    def test_model_clean_rejects_odometer_future_regression(self):
        """An earlier fuel record with a higher odometer than a later one must fail on update."""
        good = FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 10),
            odometer_km=2000,
            liters=Decimal("10.0"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        FuelRecord.objects.create(
            motorcycle=self.motorcycle,
            date=date(2026, 4, 15),
            odometer_km=2500,
            liters=Decimal("10.0"),
            total_price=Decimal("70.00"),
            price_per_liter=Decimal("7.000"),
        )
        good.odometer_km = 3000
        with self.assertRaises(ValidationError) as cm:
            good.full_clean()
        self.assertIn("odometer_km", cm.exception.message_dict)
