from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from apps.documents.models import MotorcycleDocument
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenancePlanItem
from apps.reminders.models import Reminder
from apps.reminders.services import ReminderStatus, evaluate_reminder
from apps.tires.models import TireRecord


@dataclass(frozen=True)
class NotificationAlert:
    source: str
    tone: str
    message: str


def notification_alerts_for_motorcycle(motorcycle: Motorcycle, *, limit: int = 6) -> list[NotificationAlert]:
    motorcycle.refresh_from_db(fields=["current_odometer_km"])
    today = timezone.localdate()
    current_odometer = int(motorcycle.current_odometer_km or 0)
    alerts: list[NotificationAlert] = []

    for reminder in Reminder.objects.filter(motorcycle=motorcycle, is_active=True).order_by("reference_date", "reference_km"):
        evaluation = evaluate_reminder(reminder, current_odometer_km=current_odometer, today=today)
        if evaluation.status in {ReminderStatus.OVERDUE, ReminderStatus.DUE_SOON}:
            tone = "danger" if evaluation.status == ReminderStatus.OVERDUE else "warning"
            alerts.append(NotificationAlert(source="reminder", tone=tone, message=f"Lembrete: {reminder.title}"))

    soon_date = today + timedelta(days=30)
    for document in MotorcycleDocument.objects.filter(
        motorcycle=motorcycle, valid_until__isnull=False, valid_until__lte=soon_date
    ).order_by("valid_until"):
        tone = "danger" if document.valid_until and document.valid_until <= today else "warning"
        alerts.append(NotificationAlert(source="documents", tone=tone, message=f"Documento: {document.name} vence em breve."))

    for item in MaintenancePlanItem.objects.filter(motorcycle=motorcycle, is_active=True):
        due_by_km = bool(item.interval_km and item.last_done_km is not None and item.last_done_km + item.interval_km <= current_odometer)
        due_by_date = bool(item.interval_days and item.last_done_date and item.last_done_date + timedelta(days=item.interval_days) <= today)
        if due_by_km or due_by_date:
            alerts.append(NotificationAlert(source="maintenance", tone="warning", message=f"Manutenção pendente: {item.get_maintenance_type_display()}"))

    for tire in TireRecord.objects.filter(motorcycle=motorcycle, is_active=True, wear_percent__gte=70).order_by("-wear_percent"):
        alerts.append(NotificationAlert(source="tires", tone="warning", message=f"Pneu em atenção: {tire.get_position_display()}"))

    return alerts[:limit]
