from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.reminders.models import Reminder
from apps.reminders.services import ReminderStatus, evaluate_reminder

logger = logging.getLogger(__name__)


def process_due_reminders(*, mark_notified: bool = False, writer=None) -> dict[str, int]:
    today = timezone.localdate()
    qs = (
        Reminder.objects.filter(is_active=True, motorcycle__is_active=True)
        .select_related("motorcycle", "motorcycle__owner")
        .order_by("motorcycle__name", "title")
    )

    due = 0
    emailed = 0
    marked = 0
    for reminder in qs:
        current_odo = int(reminder.motorcycle.current_odometer_km or 0)
        evaluation = evaluate_reminder(reminder, current_odometer_km=current_odo, today=today)
        if evaluation.status not in {ReminderStatus.OVERDUE, ReminderStatus.DUE_SOON}:
            continue

        due += 1
        if writer:
            writer(f"[{evaluation.status}] {reminder.motorcycle.name} :: {reminder.title}")

        notified = False
        owner = reminder.motorcycle.owner
        if reminder.send_email and owner.email:
            subject = f"Moto Track: {reminder.title}"
            message = (
                f"{reminder.motorcycle.name}: {reminder.title}\n"
                f"Status: {evaluation.status}\n\n"
                f"{reminder.description or reminder.notes or 'Revise este lembrete no Moto Track.'}"
            )
            sent = send_mail(
                subject,
                message,
                getattr(settings, "DEFAULT_FROM_EMAIL", None),
                [owner.email],
                fail_silently=False,
            )
            notified = sent > 0
            if notified:
                emailed += 1

        if mark_notified or notified:
            reminder.last_notified_at = timezone.now()
            reminder.save(update_fields=["last_notified_at"])
            marked += 1

    return {"due": due, "emailed": emailed, "marked": marked}


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def process_reminders_task(self, *, mark_notified: bool = False):  # noqa: ARG001
    try:
        return process_due_reminders(mark_notified=mark_notified)
    except Exception:
        logger.exception("Reminder processing failed.")
        raise
