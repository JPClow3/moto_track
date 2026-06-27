from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Max, Min
from django.utils import timezone

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.reminders.models import Reminder, TriggerType

logger = logging.getLogger(__name__)


def calculate_moving_average_km_per_day(motorcycle: Motorcycle, days=30) -> float:
    """Calculates the average km per day over the last `days` days based on FuelRecords."""
    thirty_days_ago = timezone.localdate() - timedelta(days=days)

    # We use fuel records since they have reliable odometer and date fields.
    # To get the rate, we need at least two records, or min and max in the last 30 days.
    records = FuelRecord.objects.filter(motorcycle=motorcycle, date__gte=thirty_days_ago).aggregate(
        min_km=Min("odometer_km"), max_km=Max("odometer_km"), min_date=Min("date"), max_date=Max("date")
    )

    if (
        records["min_km"] is not None
        and records["max_km"] is not None
        and records["min_date"] is not None
        and records["max_date"] is not None
    ):
        diff_km = records["max_km"] - records["min_km"]
        diff_days = (records["max_date"] - records["min_date"]).days
        if diff_days > 0 and diff_km > 0:
            return diff_km / diff_days

    # Fallback to overall average if < 2 records in 30 days
    if motorcycle.current_odometer_km is not None and motorcycle.created_at is not None:
        days_since_creation = (timezone.now() - motorcycle.created_at).days
        if days_since_creation > 0:
            return float(motorcycle.current_odometer_km) / days_since_creation

    return 0.0


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def predict_maintenance_needs(self):
    """
    Evaluates km-based reminders and extrapolates a due date based on the
    user's 30-day moving average of mileage.
    """
    logger.info("Starting AI maintenance prediction task...")
    today = timezone.localdate()

    # Get all active reminders that have a km-based trigger.
    reminders = Reminder.objects.filter(
        is_active=True, motorcycle__is_active=True, trigger_type__in=[TriggerType.BY_KM, TriggerType.BY_INTERVAL]
    ).select_related("motorcycle", "motorcycle__owner")

    emailed_count = 0

    for reminder in reminders:
        motorcycle = reminder.motorcycle
        current_odometer = motorcycle.current_odometer_km
        if current_odometer is None or reminder.reference_km is None or reminder.trigger_value_km is None:
            continue

        due_km = reminder.reference_km + reminder.trigger_value_km
        remaining_km = due_km - current_odometer

        # If it's already overdue or very close, the regular reminder system handles it.
        # We only want to predict when it's > 200 km away.
        if remaining_km <= 200:
            continue

        km_per_day = calculate_moving_average_km_per_day(motorcycle, days=30)

        if km_per_day <= 0:
            continue

        days_until_due = remaining_km / km_per_day

        # If the prediction falls within the next 30 days, notify the user.
        if 0 < days_until_due <= 30:
            predicted_date = today + timedelta(days=int(days_until_due))

            # Use cache to avoid spamming the user every day with the same prediction
            cache_key = f"maintenance_prediction_email_{reminder.id}_{predicted_date.isoformat()}"
            if cache.get(cache_key):
                continue

            owner = motorcycle.owner
            if owner.email:
                subject = f"Moto Track: Previsão de Manutenção - {reminder.title}"
                message = (
                    f"Olá!\n\n"
                    f"Com base no seu histórico de uso dos últimos 30 dias ({km_per_day:.1f} km/dia), "
                    f"prevemos que a manutenção '{reminder.title}' para a sua moto '{motorcycle.name}' "
                    f"será necessária por volta do dia {predicted_date.strftime('%d/%m/%Y')}.\n\n"
                    f"Faltam aproximadamente {int(remaining_km)} km para atingir o limite.\n\n"
                    f"Equipe Moto Track"
                )
                try:
                    send_mail(
                        subject,
                        message,
                        getattr(settings, "DEFAULT_FROM_EMAIL", None),
                        [owner.email],
                        fail_silently=False,
                    )
                    cache.set(cache_key, True, timeout=60 * 60 * 24 * 15)  # Don't send again for 15 days
                    emailed_count += 1
                except Exception:
                    logger.exception("Failed to send AI prediction email to %s", owner.email)

    return {"emailed": emailed_count}
