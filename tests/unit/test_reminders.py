from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.garage.models import Motorcycle
from apps.reminders.forms import ReminderForm
from apps.reminders.models import Reminder, TriggerType


class ReminderTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="rem-user", email="rem@example.com", password="pass12345")
        self.other_user = User.objects.create_user(
            username="other-user", email="other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023
        )
        self.other_motorcycle = Motorcycle.objects.create(
            owner=self.other_user, name="Moto B", brand="Yamaha", model="MT", year=2024
        )

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

    def test_by_interval_rejects_km_interval_without_reference_km_even_with_valid_date_component(self):
        reminder = Reminder(
            motorcycle=self.motorcycle,
            title="Revisao",
            trigger_type=TriggerType.BY_INTERVAL,
            trigger_value_km=3000,
            trigger_value_days=180,
            reference_date=date(2026, 4, 13),
        )

        with self.assertRaises(ValidationError) as ctx:
            reminder.full_clean()

        self.assertIn("reference_km", ctx.exception.message_dict)

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
        self.user = User.objects.create_user(
            username="rem-view-user", email="rem-view@example.com", password="pass12345"
        )
        self.other_user = User.objects.create_user(
            username="rem-view-other", email="rem-view-other@example.com", password="pass12345"
        )
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto A", brand="Honda", model="CB", year=2023
        )
        self.other_motorcycle = Motorcycle.objects.create(
            owner=self.other_user, name="Moto B", brand="Yamaha", model="MT", year=2024
        )
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

    def test_snooze_km_increments_reference_km(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("reminders:snooze_km", args=[self.reminder.pk, 500]))
        self.assertEqual(response.status_code, 302)
        self.reminder.refresh_from_db()
        self.assertEqual(self.reminder.reference_km, 10500)

    def test_snooze_days_sets_reference_date(self):
        self.reminder.trigger_type = TriggerType.BY_DATE
        self.reminder.trigger_value_days = 30
        self.reminder.reference_date = date(2026, 4, 1)
        self.reminder.reference_km = None
        self.reminder.save()

        self.client.force_login(self.user)
        response = self.client.post(reverse("reminders:snooze_days", args=[self.reminder.pk, 15]))
        self.assertEqual(response.status_code, 302)
        self.reminder.refresh_from_db()
        self.assertEqual(self.reminder.reference_date, date(2026, 4, 16))

    def test_list_evaluates_reminders_with_each_motorcycle_odometer(self):
        second_motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto Z",
            brand="Honda",
            model="ADV",
            year=2024,
            odometer_override_km=5000,
        )
        reminder = Reminder.objects.create(
            motorcycle=second_motorcycle,
            title="Lembrete da segunda moto",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=500,
            reference_km=4500,
            is_active=True,
        )

        self.client.force_login(self.user)
        response = self.client.get(reverse("reminders:list"))
        entry = next(item for item in response.context["active_reminders"] if item["reminder"] == reminder)

        self.assertEqual(entry["evaluation"].status, "overdue")

    def test_inactive_reminders_are_ordered_paginated_and_scoped(self):
        base_time = timezone.now()
        for index in range(55):
            reminder = Reminder.objects.create(
                motorcycle=self.motorcycle,
                title=f"Inativo {index:02d}",
                trigger_type=TriggerType.BY_KM,
                trigger_value_km=1000,
                reference_km=10000,
                is_active=False,
            )
            Reminder.objects.filter(pk=reminder.pk).update(updated_at=base_time + timedelta(minutes=index))
        other = Reminder.objects.create(
            motorcycle=self.other_motorcycle,
            title="Inativo de outro usuário",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=1000,
            reference_km=10000,
            is_active=False,
        )
        Reminder.objects.filter(pk=other.pk).update(updated_at=base_time + timedelta(days=1))

        self.client.force_login(self.user)
        response = self.client.get(reverse("reminders:list"))
        inactive = list(response.context["inactive_reminders"])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(inactive), 50)
        self.assertEqual(response.context["inactive_page_obj"].paginator.count, 55)
        self.assertEqual(inactive[0].title, "Inativo 54")
        self.assertEqual(inactive[-1].title, "Inativo 05")
        self.assertNotIn("Inativo 04", [reminder.title for reminder in inactive])
        self.assertNotIn("Inativo de outro usuário", [reminder.title for reminder in inactive])

        response = self.client.get(reverse("reminders:list"), {"inactive_page": 2})
        inactive = list(response.context["inactive_reminders"])

        self.assertEqual(len(inactive), 5)
        self.assertEqual(inactive[0].title, "Inativo 04")
        self.assertEqual(inactive[-1].title, "Inativo 00")
    def test_list_filters_by_search_status_and_motorcycle(self):
        second_motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto Filtro", brand="Honda", model="ADV", year=2024
        )
        Reminder.objects.create(
            motorcycle=second_motorcycle,
            title="Documento pendente",
            trigger_type=TriggerType.BY_DATE,
            trigger_value_days=1,
            reference_date=date(2026, 4, 1),
            is_active=True,
        )
        Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Lembrete arquivado",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=1000,
            reference_km=10000,
            is_active=False,
        )

        self.client.force_login(self.user)
        response = self.client.get(
            reverse("reminders:list"),
            {"q": "Documento", "status": "active", "motorcycle": second_motorcycle.pk},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Documento pendente")
        self.assertNotContains(response, "Troca de Ã³leo")
        self.assertNotContains(response, "Lembrete arquivado")
        self.assertEqual(response.context["filters"]["q"], "Documento")


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@mototrack.local",
)
class ReminderCommandTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="rem-command-user",
            email="rem-command@example.com",
            password="pass12345",
        )
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user,
            name="Moto Comando",
            brand="Honda",
            model="CB",
            year=2024,
            odometer_override_km=1000,
        )
        mail.outbox = []

    def test_process_reminders_sends_email_and_marks_only_sent_reminders(self):
        should_email = Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Com email",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=100,
            reference_km=0,
            send_email=True,
        )
        no_email = Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Sem email",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=100,
            reference_km=0,
            send_email=False,
        )

        call_command("process_reminders")

        should_email.refresh_from_db()
        no_email.refresh_from_db()
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Com email", mail.outbox[0].subject)
        self.assertIsNotNone(should_email.last_notified_at)
        self.assertIsNone(no_email.last_notified_at)

    def test_process_reminders_mark_notified_marks_without_email(self):
        reminder = Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Marcar sem email",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=100,
            reference_km=0,
            send_email=False,
        )

        call_command("process_reminders", mark_notified=True)

        reminder.refresh_from_db()
        self.assertEqual(len(mail.outbox), 0)
        self.assertIsNotNone(reminder.last_notified_at)

    def test_process_reminders_celery_task_runs_same_processing(self):
        reminder = Reminder.objects.create(
            motorcycle=self.motorcycle,
            title="Task email",
            trigger_type=TriggerType.BY_KM,
            trigger_value_km=100,
            reference_km=0,
            send_email=True,
        )

        from apps.reminders.tasks import process_reminders_task

        result = process_reminders_task.apply(kwargs={"mark_notified": False})

        self.assertTrue(result.successful())
        reminder.refresh_from_db()
        self.assertEqual(result.result["due"], 1)
        self.assertEqual(result.result["emailed"], 1)
        self.assertIsNotNone(reminder.last_notified_at)
