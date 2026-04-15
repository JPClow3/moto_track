from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.reminders.models import Reminder
from apps.reminders.services import ReminderStatus, evaluate_reminder


class Command(BaseCommand):
    help = "Process active reminders and print due/overdue items (cron-friendly)."

    def add_arguments(self, parser):
        parser.add_argument("--mark-notified", action="store_true", help="Update last_notified_at for due reminders.")

    def handle(self, *args, **options):  # noqa: ARG002
        today = timezone.localdate()
        mark = bool(options.get("mark_notified"))

        qs = (
            Reminder.objects.filter(is_active=True, motorcycle__is_active=True)
            .select_related("motorcycle")
            .order_by("motorcycle__name", "title")
        )

        due = 0
        for reminder in qs:
            current_odo = int(reminder.motorcycle.current_odometer_km or 0)
            evaluation = evaluate_reminder(reminder, current_odometer_km=current_odo, today=today)
            if evaluation.status not in {ReminderStatus.OVERDUE, ReminderStatus.DUE_SOON}:
                continue

            due += 1
            self.stdout.write(f"[{evaluation.status}] {reminder.motorcycle.name} :: {reminder.title}")

            if mark:
                reminder.last_notified_at = timezone.now()
                reminder.save(update_fields=["last_notified_at"])

        self.stdout.write(self.style.SUCCESS(f"Processed reminders. Due/soon/overdue: {due}"))
