from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django import forms
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from typing import Any, cast

from apps.fuel.forms import FuelRecordQuickForm
from apps.fuel.models import FuelGrade, FuelRecord, FuelStation, FuelType
from apps.fuel.services import compute_average_consumption_km_per_liter
from apps.garage.models import Motorcycle


class FuelModelTests(TestCase):
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

	def test_quick_form_limits_querysets_to_owner(self):
		form = FuelRecordQuickForm(user=self.user)
		motorcycle_field = cast(forms.ModelChoiceField, form.fields["motorcycle"])
		station_field = cast(forms.ModelChoiceField, form.fields["station"])
		fuel_grade_field = cast(forms.ModelChoiceField, form.fields["fuel_grade"])

		self.assertEqual(list(motorcycle_field.queryset), [self.motorcycle])
		self.assertEqual(list(station_field.queryset), [self.station])
		self.assertEqual(list(fuel_grade_field.queryset), [self.grade])

	def test_catalog_view_only_shows_owned_catalogs(self):
		self.client.force_login(self.user)
		response = self.client.get(reverse("fuel:catalogs"))

		self.assertContains(response, "Posto A")
		self.assertNotContains(response, "Posto B")
		self.assertContains(response, "Gasolina premium")
		self.assertNotContains(response, "Etanol")

	def test_quick_create_invalid_htmx_returns_form_error_response(self):
		self.client.force_login(self.user)
		response = self.client.post(reverse("fuel:quick_create"), {}, HTTP_HX_REQUEST="true", HTTP_HOST="localhost")

		self.assertEqual(response.status_code, 422)
		self.assertIn("Adicionar abastecimento", response.content.decode())

	def test_repeat_last_opens_modal_and_creates_record(self):
		FuelRecord.objects.create(  # pylint: disable=no-member
			motorcycle=self.motorcycle,
			station=self.station,
			fuel_grade=self.grade,
			date=date(2026, 4, 1),
			odometer_km=100,
			liters=Decimal("10.0"),
			total_price=Decimal("70.00"),
			price_per_liter=Decimal("7.000"),
			fuel_type=FuelType.PREMIUM_GASOLINE,
			tank_full=True,
			station_name="Posto A",
		)

		self.client.force_login(self.user)
		response = self.client.get(reverse("fuel:repeat_last"), HTTP_HX_REQUEST="true", HTTP_HOST="localhost")
		self.assertEqual(response.status_code, 200)
		self.assertIn("Repetir abastecimento", response.content.decode())

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

	def test_compute_average_consumption_uses_full_tank_anchors(self):
		FuelRecord.objects.create(  # pylint: disable=no-member
			motorcycle=self.motorcycle,
			date=date(2026, 4, 1),
			odometer_km=0,
			liters=Decimal("10.0"),
			total_price=Decimal("70.00"),
			price_per_liter=Decimal("7.000"),
			tank_full=True,
		)
		FuelRecord.objects.create(  # pylint: disable=no-member
			motorcycle=self.motorcycle,
			date=date(2026, 4, 5),
			odometer_km=120,
			liters=Decimal("3.0"),
			total_price=Decimal("21.00"),
			price_per_liter=Decimal("7.000"),
			tank_full=False,
		)
		FuelRecord.objects.create(  # pylint: disable=no-member
			motorcycle=self.motorcycle,
			date=date(2026, 4, 10),
			odometer_km=300,
			liters=Decimal("12.0"),
			total_price=Decimal("84.00"),
			price_per_liter=Decimal("7.000"),
			tank_full=True,
		)

		history = list(
			FuelRecord.objects.filter(motorcycle=self.motorcycle).order_by(
				"date", "odometer_km"
			)  # pylint: disable=no-member
		)
		stats = compute_average_consumption_km_per_liter(history)
		self.assertIsNotNone(stats)
		self.assertEqual(cast(Any, stats).km_per_liter, 20.0)
