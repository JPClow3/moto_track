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

    If an older event has a higher odometer, or a newer event has a lower odometer,
    the new/edited event would make the timeline physically inconsistent.
    """
    if not motorcycle or not event_date or odometer_km in (None, ""):
        return {}

    try:
        odometer = int(odometer_km)
    except (TypeError, ValueError):
        return {}

    events: list[tuple[str, date, int, int]] = []

    for record in motorcycle.fuel_records.all().only("id", "date", "odometer_km"):
        events.append(("fuel.FuelRecord", record.date, int(record.odometer_km or 0), record.pk))
    for record in motorcycle.maintenance_records.all().only("id", "date", "odometer_km"):
        events.append(("maintenance.MaintenanceRecord", record.date, int(record.odometer_km or 0), record.pk))
    for record in motorcycle.tire_records.all().only("id", "installed_at", "installed_odometer_km"):
        events.append(("tires.TireRecord", record.installed_at, int(record.installed_odometer_km or 0), record.pk))

    for model_label, other_date, other_odometer, other_pk in events:
        if exclude_model == model_label and exclude_pk and int(exclude_pk) == int(other_pk):
            continue
        if other_date < event_date and other_odometer > odometer:
            return {"odometer_km": "Existe um evento anterior com odômetro maior que este valor."}
        if other_date > event_date and other_odometer < odometer:
            return {"odometer_km": "Existe um evento posterior com odômetro menor que este valor."}

    return {}


def add_form_errors(form: forms.Form, errors: dict[str, str]) -> None:
    for field, message in errors.items():
        if field in form.fields:
            form.add_error(field, message)
        else:
            form.add_error(None, message)
