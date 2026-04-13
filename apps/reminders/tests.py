from datetime import date

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from apps.garage.models import Motorcycle
from apps.reminders.models import Reminder, TriggerType


class ReminderTests(TestCase):
	def setUp(self):
		User = get_user_model()
		self.user = User.objects.create_user(username="rem-user", email="rem@example.com", password="pass12345")
		self.other_user = User.objects.create_user(username="other-user", email="other@example.com", password="pass12345")
		self.motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023)
		self.other_motorcycle = Motorcycle.objects.create(owner=self.other_user, name="Moto B", brand="Yamaha", model="MT", year=2024)

	def test_by_km_requires_reference_km(self):
		reminder = Reminder(
			motorcycle=self.motorcycle,
			title="Troca de óleo",
			trigger_type=TriggerType.BY_KM,
			trigger_value_km=1000,
		)

		with self.assertRaises(ValidationError):
			reminder.full_clean()

	def test_by_interval_accepts_km_and_date_when_references_provided(self):
		reminder = Reminder(
			motorcycle=self.motorcycle,
			title="Revisão",
			trigger_type=TriggerType.BY_INTERVAL,
			trigger_value_km=3000,
			trigger_value_days=180,
			reference_km=10000,
			reference_date=date(2026, 4, 13),
		)

		reminder.full_clean()

	def test_reminders_list_is_owner_scoped(self):
		Reminder.objects.create(
			motorcycle=self.motorcycle,
			title="Ativo A",
			trigger_type=TriggerType.BY_KM,
			trigger_value_km=1000,
			reference_km=10000,
			is_active=True,
		)
		Reminder.objects.create(
			motorcycle=self.other_motorcycle,
			title="Ativo B",
			trigger_type=TriggerType.BY_KM,
			trigger_value_km=1000,
			reference_km=5000,
			is_active=True,
		)

		self.client.force_login(self.user)
		response = self.client.get(reverse("reminders:list"))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, "Ativo A")
		self.assertNotContains(response, "Ativo B")
