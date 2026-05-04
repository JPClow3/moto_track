from __future__ import annotations

from datetime import date

from django.db import OperationalError, ProgrammingError
from django.utils import timezone

from apps.documents.models import MotorcycleDocument
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenancePhoto
from apps.reminders.models import Reminder

from .models import BillingPlan, SubscriptionProfile

FREE_ACTIVE_MOTORCYCLE_LIMIT = 1
FREE_UPLOAD_LIMIT = 3
FREE_REMINDER_LIMIT = 3
FREE_WORK_SESSION_MONTHLY_LIMIT = 3


def get_subscription_profile(user) -> SubscriptionProfile | None:
    if not getattr(user, "is_authenticated", False):
        return None
    try:
        return getattr(user, "subscription_profile", None)
    except (SubscriptionProfile.DoesNotExist, OperationalError, ProgrammingError):
        return None


def ensure_subscription_profile(user) -> SubscriptionProfile:
    profile = get_subscription_profile(user)
    if profile:
        return profile
    return SubscriptionProfile.objects.create(user=user)


def has_pro_access(user) -> bool:
    profile = get_subscription_profile(user)
    return bool(profile and profile.has_pro_access())


def plan_label(user) -> str:
    return "Pro" if has_pro_access(user) else "Free"


def is_free(user) -> bool:
    return not has_pro_access(user)


def can_add_active_motorcycle(user, *, instance: Motorcycle | None = None) -> bool:
    if has_pro_access(user):
        return True
    active = Motorcycle.objects.filter(owner=user, is_active=True)
    if instance and instance.pk:
        active = active.exclude(pk=instance.pk)
    return active.count() < FREE_ACTIVE_MOTORCYCLE_LIMIT


def upload_count(user) -> int:
    docs = MotorcycleDocument.objects.filter(motorcycle__owner=user, motorcycle__is_active=True).count()
    fuel_receipts = (
        FuelRecord.objects.filter(motorcycle__owner=user, motorcycle__is_active=True)
        .exclude(receipt_file="")
        .count()
    )
    maintenance_photos = MaintenancePhoto.objects.filter(
        maintenance_record__motorcycle__owner=user,
        maintenance_record__motorcycle__is_active=True,
    ).count()
    return docs + fuel_receipts + maintenance_photos


def remaining_upload_slots(user) -> int | None:
    if has_pro_access(user):
        return None
    return max(FREE_UPLOAD_LIMIT - upload_count(user), 0)


def can_add_uploads(user, *, incoming_count: int = 1) -> bool:
    remaining = remaining_upload_slots(user)
    if remaining is None:
        return True
    return incoming_count <= remaining


def active_reminder_count(user) -> int:
    return Reminder.objects.filter(motorcycle__owner=user, motorcycle__is_active=True, is_active=True).count()


def can_add_active_reminder(user, *, instance: Reminder | None = None, will_be_active: bool = True) -> bool:
    if has_pro_access(user) or not will_be_active:
        return True
    active = Reminder.objects.filter(motorcycle__owner=user, motorcycle__is_active=True, is_active=True)
    if instance and instance.pk:
        active = active.exclude(pk=instance.pk)
    return active.count() < FREE_REMINDER_LIMIT


def can_add_work_session(user, *, work_date: date | None = None, instance=None) -> bool:
    if has_pro_access(user):
        return True
    from apps.work.models import WorkSession

    work_date = work_date or timezone.localdate()
    sessions = WorkSession.objects.filter(
        owner=user,
        work_date__year=work_date.year,
        work_date__month=work_date.month,
    )
    if instance and instance.pk:
        sessions = sessions.exclude(pk=instance.pk)
    return sessions.count() < FREE_WORK_SESSION_MONTHLY_LIMIT


def pro_features() -> dict[str, str]:
    return {
        "exports": "Exportacoes CSV/PDF",
        "sale_report": "Dossie publico de venda",
        "advanced_reports": "Relatorios avancados",
        "professional_dashboard": "Painel de lucro profissional",
    }
