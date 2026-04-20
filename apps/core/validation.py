from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django import forms
from django.utils import timezone


def money_amount(value: Any) -> Decimal | None:
    if value is None:
        return None
    if hasattr(value, "amount"):
        return Decimal(str(value.amount))
    return Decimal(str(value))


def validate_not_future(*, field_name: str, value: date | None, message: str | None = None) -> dict[str, str]:
    if value and value > timezone.localdate():
        return {field_name: message or "A data não pode estar no futuro."}
    return {}


def validate_odometer_sequence(
    *,
    motorcycle,
    event_date: date | None,
    odometer_km: int | None,
    exclude_model: str | None = None,
    exclude_pk: int | None = None,
) -> dict[str, str]:
    """
    Block deterministic odometer regressions across dated motorcycle events.

    Uses targeted EXISTS queries instead of loading the full event history.
    """
    if not motorcycle or not event_date or odometer_km in (None, ""):
        return {}

    try:
        odometer = int(odometer_km)
    except (TypeError, ValueError):
        return {}

    from apps.fuel.models import FuelRecord
    from apps.maintenance.models import MaintenanceRecord
    from apps.tires.models import TireRecord

    checks = [
        ("fuel.FuelRecord", FuelRecord.objects.filter(motorcycle=motorcycle), "date", "odometer_km"),
        ("maintenance.MaintenanceRecord", MaintenanceRecord.objects.filter(motorcycle=motorcycle), "date", "odometer_km"),
        ("tires.TireRecord", TireRecord.objects.filter(motorcycle=motorcycle), "installed_at", "installed_odometer_km"),
    ]

    for model_label, qs, date_field, odometer_field in checks:
        if exclude_model == model_label and exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        if qs.filter(**{f"{date_field}__lt": event_date, f"{odometer_field}__gt": odometer}).exists():
            return {"odometer_km": "Existe um evento anterior com odômetro maior que este valor."}
        if qs.filter(**{f"{date_field}__gt": event_date, f"{odometer_field}__lt": odometer}).exists():
            return {"odometer_km": "Existe um evento posterior com odômetro menor que este valor."}

    return {}


def add_form_errors(form: forms.Form, errors: dict[str, str]) -> None:
    for field, message in errors.items():
        if field in form.fields:
            form.add_error(field, message)
        else:
            form.add_error(None, message)
