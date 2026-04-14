from datetime import date

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from apps.garage.models import Motorcycle
from apps.reminders.forms import ReminderForm
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

	def test_reminder_form_uses_model_trigger_rules(self):
		form = ReminderForm(
			data={
				"motorcycle": self.motorcycle.pk,
				"title": "Troca filtro",
				"trigger_type": TriggerType.BY_DATE,
				"trigger_value_days": 30,
				"reference_km": 12000,
				"is_active": True,
				"send_email": True,
			},
			user=self.user,
		)

		self.assertFalse(form.is_valid())
		self.assertIn("reference_km", form.errors)


class ReminderViewTests(TestCase):
	def setUp(self):
		User = get_user_model()
		self.user = User.objects.create_user(username="rem-view-user", email="rem-view@example.com", password="pass12345")
		self.other_user = User.objects.create_user(username="rem-view-other", email="rem-view-other@example.com", password="pass12345")
		self.motorcycle = Motorcycle.objects.create(owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023)
		self.other_motorcycle = Motorcycle.objects.create(owner=self.other_user, name="Moto B", brand="Yamaha", model="MT", year=2024)
		self.reminder = Reminder.objects.create(
			motorcycle=self.motorcycle,
			title="Troca de óleo",
			trigger_type=TriggerType.BY_KM,
			trigger_value_km=1000,
			reference_km=10000,
		)
		self.other_reminder = Reminder.objects.create(
			motorcycle=self.other_motorcycle,
			title="Outro lembrete",
			trigger_type=TriggerType.BY_KM,
			trigger_value_km=1500,
			reference_km=9000,
		)

	def test_create_view_creates_reminder(self):
		self.client.force_login(self.user)
		response = self.client.post(
			reverse("reminders:create"),
			{
				"motorcycle": self.motorcycle.pk,
				"title": "Revisao anual",
				"trigger_type": TriggerType.BY_DATE,
				"trigger_value_days": 365,
				"reference_date": "2026-04-14",
				"is_active": True,
				"send_email": True,
			},
		)

		self.assertEqual(response.status_code, 302)
		self.assertTrue(Reminder.objects.filter(motorcycle=self.motorcycle, title="Revisao anual").exists())

	def test_update_view_denies_other_user_reminder(self):
		self.client.force_login(self.user)
		response = self.client.get(reverse("reminders:update", args=[self.other_reminder.pk]))

		self.assertEqual(response.status_code, 404)

	def test_delete_view_removes_owned_reminder(self):
		self.client.force_login(self.user)
		response = self.client.post(reverse("reminders:delete", args=[self.reminder.pk]))

		self.assertEqual(response.status_code, 302)
		self.assertFalse(Reminder.objects.filter(pk=self.reminder.pk).exists())
