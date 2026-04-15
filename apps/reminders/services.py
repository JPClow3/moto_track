from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from .models import Reminder, TriggerType


class ReminderStatus:
    OVERDUE = "overdue"
    DUE_SOON = "due_soon"
    OK = "ok"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class ReminderEvaluation:
    status: str
    due_km: int | None = None
    remaining_km: int | None = None
    due_date: date | None = None
    remaining_days: int | None = None


def evaluate_reminder(reminder: Reminder, *, current_odometer_km: int, today: date) -> ReminderEvaluation:
    soon_km_threshold = 200
    soon_days_threshold = 7

    if reminder.trigger_type == TriggerType.BY_KM:
        if reminder.reference_km is None or reminder.trigger_value_km is None:
            return ReminderEvaluation(status=ReminderStatus.UNKNOWN)
        due_km = reminder.reference_km + reminder.trigger_value_km
        remaining = due_km - current_odometer_km
        if remaining <= 0:
            return ReminderEvaluation(status=ReminderStatus.OVERDUE, due_km=due_km, remaining_km=remaining)
        if remaining <= soon_km_threshold:
            return ReminderEvaluation(status=ReminderStatus.DUE_SOON, due_km=due_km, remaining_km=remaining)
        return ReminderEvaluation(status=ReminderStatus.OK, due_km=due_km, remaining_km=remaining)

    if reminder.trigger_type == TriggerType.BY_DATE:
        if reminder.reference_date is None or reminder.trigger_value_days is None:
            return ReminderEvaluation(status=ReminderStatus.UNKNOWN)
        due_date = reminder.reference_date + timedelta(days=reminder.trigger_value_days)
        remaining = (due_date - today).days
        if remaining <= 0:
            return ReminderEvaluation(status=ReminderStatus.OVERDUE, due_date=due_date, remaining_days=remaining)
        if remaining <= soon_days_threshold:
            return ReminderEvaluation(status=ReminderStatus.DUE_SOON, due_date=due_date, remaining_days=remaining)
        return ReminderEvaluation(status=ReminderStatus.OK, due_date=due_date, remaining_days=remaining)

    # BY_INTERVAL: evaluate both components (if present) and return the "worst" status.
    if reminder.trigger_type == TriggerType.BY_INTERVAL:
        evals: list[ReminderEvaluation] = []
        if reminder.trigger_value_km is not None and reminder.reference_km is not None:
            due_km = reminder.reference_km + reminder.trigger_value_km
            remaining = due_km - current_odometer_km
            if remaining <= 0:
                evals.append(ReminderEvaluation(status=ReminderStatus.OVERDUE, due_km=due_km, remaining_km=remaining))
            elif remaining <= soon_km_threshold:
                evals.append(ReminderEvaluation(status=ReminderStatus.DUE_SOON, due_km=due_km, remaining_km=remaining))
            else:
                evals.append(ReminderEvaluation(status=ReminderStatus.OK, due_km=due_km, remaining_km=remaining))
        if reminder.trigger_value_days is not None and reminder.reference_date is not None:
            due_date = reminder.reference_date + timedelta(days=reminder.trigger_value_days)
            remaining = (due_date - today).days
            if remaining <= 0:
                evals.append(
                    ReminderEvaluation(status=ReminderStatus.OVERDUE, due_date=due_date, remaining_days=remaining)
                )
            elif remaining <= soon_days_threshold:
                evals.append(
                    ReminderEvaluation(status=ReminderStatus.DUE_SOON, due_date=due_date, remaining_days=remaining)
                )
            else:
                evals.append(ReminderEvaluation(status=ReminderStatus.OK, due_date=due_date, remaining_days=remaining))
        if not evals:
            return ReminderEvaluation(status=ReminderStatus.UNKNOWN)

        priority = {
            ReminderStatus.OVERDUE: 0,
            ReminderStatus.DUE_SOON: 1,
            ReminderStatus.OK: 2,
            ReminderStatus.UNKNOWN: 3,
        }
        return sorted(evals, key=lambda e: priority[e.status])[0]

    return ReminderEvaluation(status=ReminderStatus.UNKNOWN)
