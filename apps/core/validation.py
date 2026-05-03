from __future__ import annotations

from datetime import date
from decimal import Decimal

from django import forms
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone


def money_amount(value):
    if value is None:
        return None
    if hasattr(value, "amount"):
        return value.amount
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

    checks = [
        ("fuel.fuelrecord", "date", "odometer_km"),
        ("maintenance.maintenancerecord", "date", "odometer_km"),
        ("tires.tirerecord", "installed_at", "installed_odometer_km"),
    ]

    exclude_ct = None
    if exclude_model and exclude_pk:
        try:
            app_label, model_name = exclude_model.split(".")
            exclude_ct = ContentType.objects.get_by_natural_key(app_label.lower(), model_name.lower())
        except (ContentType.DoesNotExist, ValueError):
            pass

    for model_label, date_field, odometer_field in checks:
        try:
            ct = ContentType.objects.get_by_natural_key(*model_label.split("."))
        except ContentType.DoesNotExist:
            continue
        model_class = ct.model_class()
        if not model_class:
            continue
        base_qs = model_class.objects.filter(motorcycle=motorcycle)
        if exclude_model and exclude_pk and ct == exclude_ct:
            qs = base_qs.exclude(pk=exclude_pk)
        else:
            qs = base_qs
        if qs.filter(**{f"{date_field}__lt": event_date, f"{odometer_field}__gt": odometer}).exists():
            return {"odometer_km": "Existe um evento anterior com odômetro maior que este valor."}
        if qs.filter(**{f"{date_field}__gt": event_date, f"{odometer_field}__lt": odometer}).exists():
            return {"odometer_km": "Existe um evento posterior com odômetro menor que este valor."}

    return {}


def validate_instance_odometer(instance) -> dict[str, str]:
    """Run odometer sequence validation for a single model instance."""
    model_map = {
        "FuelRecord": ("fuel.fuelrecord", "date", "odometer_km"),
        "MaintenanceRecord": ("maintenance.maintenancerecord", "date", "odometer_km"),
        "TireRecord": ("tires.tirerecord", "installed_at", "installed_odometer_km"),
    }
    cls_name = type(instance).__name__
    if cls_name not in model_map:
        return {}
    model_label, date_field, odometer_field = model_map[cls_name]
    event_date = getattr(instance, date_field, None)
    odometer_km = getattr(instance, odometer_field, None)
    return validate_odometer_sequence(
        motorcycle=getattr(instance, "motorcycle", None),
        event_date=event_date,
        odometer_km=odometer_km,
        exclude_model=model_label if instance.pk else None,
        exclude_pk=instance.pk,
    )


def add_form_errors(form: forms.Form, errors: dict[str, str]) -> None:
    for field, message in errors.items():
        if field in form.fields:
            form.add_error(field, message)
        else:
            form.add_error(None, message)
