from __future__ import annotations

import logging
import time

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.core.metrics import (
    reminders_processed_total,
    reminders_run_duration_seconds,
    reminders_run_total,
)
from apps.core.services.push import send_push
from apps.reminders.models import Reminder
from apps.reminders.services import ReminderStatus, evaluate_reminder

logger = logging.getLogger(__name__)


def process_due_reminders(*, mark_notified: bool = False, writer=None) -> dict[str, int]:
    today = timezone.localdate()
    qs = (
        Reminder.objects.filter(is_active=True, motorcycle__is_active=True)
        .select_related("motorcycle", "motorcycle__owner")
        .prefetch_related("motorcycle__owner__push_subscriptions")
        .order_by("motorcycle__name", "title")
    )

    due = 0
    emailed = 0
    pushed = 0
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
        now = timezone.now()
        owner = reminder.motorcycle.owner
        update_fields = []
        legacy_already_notified = bool(
            reminder.last_notified_at
            and reminder.last_email_notified_at is None
            and reminder.last_push_notified_at is None
        )
        if reminder.send_email and owner.email and reminder.last_email_notified_at is None and not legacy_already_notified:
            subject = f"Moto Track: {reminder.title}"
            message = (
                f"{reminder.motorcycle.name}: {reminder.title}\n"
                f"Status: {evaluation.status}\n\n"
                f"{reminder.description or reminder.notes or 'Revise este lembrete no Moto Track.'}"
            )
            try:
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
                    reminder.last_email_notified_at = now
                    update_fields.append("last_email_notified_at")
            except Exception:
                logger.exception("Failed to send reminder email to %s", owner.email)

        push_notified = False
        if reminder.send_push and reminder.last_push_notified_at is None and not legacy_already_notified:
            payload = {
                "title": f"Moto Track: {reminder.title}",
                "body": f"{reminder.motorcycle.name}: {evaluation.status}",
                "url": "/reminders/",
            }
            for subscription in owner.push_subscriptions.all():
                result = send_push(subscription, payload)
                if result.delivered:
                    push_notified = True
            if push_notified:
                pushed += 1
                reminder.last_push_notified_at = now
                update_fields.append("last_push_notified_at")

        if mark_notified:
            if reminder.send_email and reminder.last_email_notified_at is None:
                reminder.last_email_notified_at = now
                update_fields.append("last_email_notified_at")
            if reminder.send_push and reminder.last_push_notified_at is None:
                reminder.last_push_notified_at = now
                update_fields.append("last_push_notified_at")

        if mark_notified or notified or push_notified:
            reminder.last_notified_at = now
            update_fields.append("last_notified_at")
        if update_fields:
            reminder.save(update_fields=sorted(set(update_fields + ["updated_at"])))
            marked += 1

    return {"due": due, "emailed": emailed, "pushed": pushed, "marked": marked}


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def process_reminders_task(self, *, mark_notified: bool = False):  # noqa: ARG001
    started = time.monotonic()
    try:
        result = process_due_reminders(mark_notified=mark_notified)
    except Exception:
        reminders_run_total.labels(outcome="error").inc()
        reminders_run_duration_seconds.observe(time.monotonic() - started)
        logger.exception("Reminder processing failed.")
        raise

    reminders_run_total.labels(outcome="success").inc()
    reminders_run_duration_seconds.observe(time.monotonic() - started)
    # `inc(N)` instead of N separate `inc()` calls keeps the histogram on the
    # job duration honest — we don't want to charge "200 reminders processed"
    # against the per-reminder counter latency.
    reminders_processed_total.labels(action="due").inc(result.get("due", 0))
    reminders_processed_total.labels(action="emailed").inc(result.get("emailed", 0))
    reminders_processed_total.labels(action="pushed").inc(result.get("pushed", 0))
    reminders_processed_total.labels(action="marked").inc(result.get("marked", 0))
    return result
