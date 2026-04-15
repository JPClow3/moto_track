"""Sync and clean up reminders derived from expenses models."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction

from apps.reminders.models import Reminder, TriggerType

from .models import AnnualFee, InsurancePolicy

# Pylint cannot infer Django's dynamically added model manager (`objects`) without a plugin.
# Silence only the `objects` false-positive in this module.
# pylint: disable=no-member


def _fee_reminder_suffix(fee: AnnualFee) -> str | None:
    # Stable identity: include fee.pk to avoid duplicates when title changes.
    if fee.pk is None:
        return None
    return f"#fee:{fee.pk}"


def _fee_reminder_title(fee: AnnualFee) -> str:
    label = fee.get_fee_type_display()  # pylint: disable=no-member
    suffix = _fee_reminder_suffix(fee)
    if suffix:
        return f"{label} {fee.year} — {fee.motorcycle.name} — {suffix}"
    return f"{label} {fee.year} — {fee.motorcycle.name}"


def _legacy_fee_reminder_title(fee: AnnualFee) -> str:
    # Previous behavior (kept only to migrate existing reminders safely).
    label = fee.get_fee_type_display()  # pylint: disable=no-member
    return f"{label} {fee.year} — {fee.motorcycle.name}"


def _find_fee_reminder(fee: AnnualFee) -> Reminder | None:
    suffix = _fee_reminder_suffix(fee)
    if suffix:
        by_pk = Reminder.objects.filter(
            motorcycle=fee.motorcycle, title__endswith=suffix
        ).first()  # pylint: disable=no-member
        if by_pk:
            return by_pk

    legacy_title = _legacy_fee_reminder_title(fee)
    return Reminder.objects.filter(
        motorcycle=fee.motorcycle, title=legacy_title
    ).first()  # pylint: disable=no-member


def _policy_reminder_title(policy: InsurancePolicy) -> str:
    provider = (policy.provider or "").strip()
    number = (policy.policy_number or "").strip()
    bits: list[str] = ["Seguro"]
    if provider:
        bits.append(provider)
    if number:
        bits.append(number)
    # Stable identity: include policy.pk to avoid collisions between multiple policies per bike.
    bits.append(f"vence {policy.coverage_end}")
    bits.append(f"#{policy.pk}")
    return " — ".join(bits)


def _legacy_policy_reminder_title(policy: InsurancePolicy) -> str:
    # Previous behavior (kept only to migrate existing reminders safely).
    return f"Seguro — {policy.motorcycle.name}"


def _find_policy_reminder(policy: InsurancePolicy) -> Reminder | None:
    # Prefer stable id match (works after motorcycle/provider changes).
    stable_suffix = f"#{policy.pk}"
    by_pk = Reminder.objects.filter(
        motorcycle=policy.motorcycle, title__endswith=stable_suffix
    ).first()  # pylint: disable=no-member
    if by_pk:
        return by_pk

    # Backward compat: previously the title included the motorcycle name.
    legacy_title = _legacy_policy_reminder_title(policy)
    return Reminder.objects.filter(
        motorcycle=policy.motorcycle, title=legacy_title
    ).first()  # pylint: disable=no-member


def _reference_date_for_due_date(*, due_date, notify_before_days: int):
    return due_date - timedelta(days=int(notify_before_days))


@transaction.atomic
def sync_fee_reminder(fee: AnnualFee) -> Reminder:
    """
    Keep a BY_DATE Reminder in sync with a fee due_date.

    Reminder semantics in this project:
    due_date = reference_date + trigger_value_days
    """
    title = _fee_reminder_title(fee)
    notify_before_days = int(fee.notify_before_days or 30)
    reference_date = _reference_date_for_due_date(
        due_date=fee.due_date,
        notify_before_days=notify_before_days,
    )

    reminder = _find_fee_reminder(fee)
    if reminder is None:
        reminder = Reminder(
            motorcycle=fee.motorcycle,
            title=title,
            trigger_type=TriggerType.BY_DATE,
            trigger_value_days=notify_before_days,
            reference_date=reference_date,
            is_active=True,
            send_email=True,
        )

    reminder.title = title
    reminder.trigger_type = TriggerType.BY_DATE
    reminder.trigger_value_days = notify_before_days
    reminder.reference_date = reference_date
    reminder.reference_km = None
    reminder.trigger_value_km = None
    reminder.is_active = True
    reminder.send_email = True
    reminder.description = f"Taxa anual ({fee.get_fee_type_display()})"  # pylint: disable=no-member
    reminder.notes = (fee.notes or "").strip()
    reminder.full_clean()
    reminder.save()
    return reminder


@transaction.atomic
def delete_fee_reminder(fee: AnnualFee) -> int:
    """Delete the reminder associated with the given annual fee (if any)."""
    suffix = _fee_reminder_suffix(fee)
    if suffix:
        deleted = Reminder.objects.filter(motorcycle=fee.motorcycle, title__endswith=suffix).delete()[0]
        if deleted:
            return deleted
    legacy_title = _legacy_fee_reminder_title(fee)
    return Reminder.objects.filter(motorcycle=fee.motorcycle, title=legacy_title).delete()[0]


@transaction.atomic
def sync_policy_reminder(policy: InsurancePolicy) -> Reminder:
    """Create/update the reminder associated with an insurance policy."""
    title = _policy_reminder_title(policy)
    notify_before_days = int(policy.notify_before_days or 30)
    reference_date = _reference_date_for_due_date(
        due_date=policy.coverage_end,
        notify_before_days=notify_before_days,
    )

    reminder = _find_policy_reminder(policy)
    if reminder is None:
        reminder = Reminder(
            motorcycle=policy.motorcycle,
            title=title,
            trigger_type=TriggerType.BY_DATE,
            trigger_value_days=notify_before_days,
            reference_date=reference_date,
            is_active=True,
            send_email=True,
        )

    reminder.title = title
    reminder.trigger_type = TriggerType.BY_DATE
    reminder.trigger_value_days = notify_before_days
    reminder.reference_date = reference_date
    reminder.reference_km = None
    reminder.trigger_value_km = None
    reminder.is_active = True
    reminder.send_email = True
    reminder.description = f"Renovação do seguro ({policy.provider})"
    reminder.notes = (policy.notes or "").strip()
    reminder.full_clean()
    reminder.save()
    return reminder


@transaction.atomic
def delete_policy_reminder(policy: InsurancePolicy) -> int:
    """Delete the reminder associated with an insurance policy (if any)."""
    stable_suffix = f"#{policy.pk}"
    deleted = Reminder.objects.filter(motorcycle=policy.motorcycle, title__endswith=stable_suffix).delete()[0]
    if deleted:
        return deleted
    legacy_title = _legacy_policy_reminder_title(policy)
    return Reminder.objects.filter(motorcycle=policy.motorcycle, title=legacy_title).delete()[0]
