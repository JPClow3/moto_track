from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.reminders.tasks import process_due_reminders, process_reminders_task


class Command(BaseCommand):
    help = "Process active reminders or enqueue the Celery task."

    def add_arguments(self, parser):
        parser.add_argument("--mark-notified", action="store_true", help="Update reminder notification timestamps for due reminders.")
        parser.add_argument("--enqueue", action="store_true", help="Send the work to Celery instead of running inline.")

    def handle(self, *args, **options):  # noqa: ARG002
        mark = bool(options.get("mark_notified"))
        if options.get("enqueue"):
            result = process_reminders_task.delay(mark_notified=mark)
            self.stdout.write(self.style.SUCCESS(f"Enqueued reminder processing task: {result.id}"))
            return

        summary = process_due_reminders(mark_notified=mark, writer=self.stdout.write)
        self.stdout.write(
            self.style.SUCCESS(
                f"Processed reminders. Due/soon/overdue: {summary['due']}. "
                f"Emails: {summary.get('emailed', 0)}. Push: {summary.get('pushed', 0)}."
            )
        )
