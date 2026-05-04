from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.core.validation import money_amount
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle

from .models import ProfessionalCostSettings, WorkSession


@dataclass(frozen=True)
class ProfessionalSummary:
    revenue: Decimal
    fuel_cost: Decimal
    maintenance_reserve: Decimal
    depreciation_cost: Decimal
    fixed_cost: Decimal
    estimated_profit: Decimal
    distance_km: int
    hours: Decimal
    profit_per_km: Decimal | None
    profit_per_hour: Decimal | None
    sessions_count: int


def _decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _month_bounds(today: date | None = None) -> tuple[date, date]:
    today = today or timezone.localdate()
    start = today.replace(day=1)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month - timedelta(days=1)


def professional_summary(*, user, motorcycle: Motorcycle | None = None, start: date | None = None, end: date | None = None) -> ProfessionalSummary:
    if start is None or end is None:
        start, end = _month_bounds()
    sessions = WorkSession.objects.filter(owner=user, work_date__gte=start, work_date__lte=end)
    fuel = FuelRecord.objects.filter(motorcycle__owner=user, date__gte=start, date__lte=end)
    if motorcycle:
        sessions = sessions.filter(motorcycle=motorcycle)
        fuel = fuel.filter(motorcycle=motorcycle)

    session_rows = list(sessions)
    revenue = sum((row.total_revenue for row in session_rows), Decimal("0"))
    distance_km = sum((row.distance_km for row in session_rows), 0)
    hours = sum((row.duration_hours for row in session_rows), Decimal("0"))
    fuel_total = money_amount(fuel.aggregate(total=Sum("total_price"))["total"]) or Decimal("0")

    settings = None
    if motorcycle:
        try:
            settings = motorcycle.professional_cost_settings
        except ProfessionalCostSettings.DoesNotExist:
            settings = None
    if settings is None:
        settings = ProfessionalCostSettings()

    maintenance_reserve = (_decimal(settings.maintenance_reserve_per_km) * Decimal(distance_km)).quantize(Decimal("0.01"))
    depreciation = (_decimal(settings.depreciation_per_km) * Decimal(distance_km)).quantize(Decimal("0.01"))
    fixed = _decimal(settings.fixed_daily_cost)
    fixed_days = {row.work_date for row in session_rows}
    fixed_cost = (fixed * Decimal(len(fixed_days))).quantize(Decimal("0.01"))
    estimated_profit = (revenue - fuel_total - maintenance_reserve - depreciation - fixed_cost).quantize(Decimal("0.01"))
    profit_per_km = (estimated_profit / Decimal(distance_km)).quantize(Decimal("0.001")) if distance_km else None
    profit_per_hour = (estimated_profit / hours).quantize(Decimal("0.001")) if hours else None
    return ProfessionalSummary(
        revenue=revenue.quantize(Decimal("0.01")),
        fuel_cost=fuel_total.quantize(Decimal("0.01")),
        maintenance_reserve=maintenance_reserve,
        depreciation_cost=depreciation,
        fixed_cost=fixed_cost,
        estimated_profit=estimated_profit,
        distance_km=distance_km,
        hours=hours,
        profit_per_km=profit_per_km,
        profit_per_hour=profit_per_hour,
        sessions_count=len(session_rows),
    )
