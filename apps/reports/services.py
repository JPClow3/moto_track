from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Max, Min, Sum
from django.urls import reverse
from django.utils import timezone

from apps.core.severity import SEVERITY_PRIORITY, Alert, Severity
from apps.core.validation import money_amount
from apps.documents.models import MotorcycleDocument
from apps.expenses.models import AnnualFee, InsurancePolicy
from apps.fuel.models import FuelRecord
from apps.fuel.services import (
    compute_average_consumption_km_per_liter,
    detect_fuel_anomalies,
    estimate_next_fill_up,
    review_suggestion_for_motorcycle,
)
from apps.maintenance.models import MaintenancePlanItem, MaintenanceRecord
from apps.reminders.models import Reminder
from apps.reminders.services import ReminderStatus, evaluate_reminder
from apps.tires.models import TirePressureRecord, TireRecord

PERIODS = (30, 90, 365)


@dataclass(frozen=True)
class CostSummary:
    fuel: Decimal
    maintenance: Decimal
    tires: Decimal
    annual_fees: Decimal
    insurance: Decimal
    total: Decimal
    distance_km: int
    cost_per_km: Decimal | None


@dataclass(frozen=True)
class PeriodComparison:
    days: int
    start: date
    end: date
    total_cost: Decimal
    distance_km: int
    cost_per_km: Decimal | None
    average_consumption_km_l: float | None


@dataclass(frozen=True)
class TimelineEvent:
    date: date
    source: str
    label: str
    title: str
    description: str
    amount: Decimal | None
    odometer_km: int | None
    severity: str
    url: str

    @property
    def priority(self) -> int:
        return SEVERITY_PRIORITY.get(self.severity, 99)


@dataclass(frozen=True)
class HealthScore:
    total: int
    maintenance: int
    tires: int
    documents: int
    data_quality: int
    notes: list[str]


@dataclass(frozen=True)
class StationUsage:
    label: str
    fillups_count: int
    liters: Decimal
    total_spend: Decimal


@dataclass(frozen=True)
class FuelUsageSummary:
    fillups_count: int
    liters_total: Decimal
    total_spend: Decimal
    average_km_between_fillups: int | None
    most_used_station: StationUsage | None


@dataclass(frozen=True)
class MaintenanceHistoryRow:
    date: date
    type_label: str
    odometer_km: int
    cost: Decimal
    workshop: str
    description: str
    parts_used: str
    next_change_km: int | None
    next_change_date: date | None


@dataclass(frozen=True)
class MaintenanceTypeSummaryRow:
    type_label: str
    count: int
    total_cost: Decimal
    latest_date: date


@dataclass(frozen=True)
class TireHistoryRow:
    installed_at: date
    position_label: str
    brand_model: str
    installed_odometer_km: int
    cost: Decimal
    wear_percent: int
    is_active: bool


@dataclass(frozen=True)
class TirePressureHistoryRow:
    date: date
    psi_front: int
    psi_rear: int
    notes: str


@dataclass(frozen=True)
class DocumentSummaryRow:
    name: str
    type_label: str
    valid_until: date | None


@dataclass(frozen=True)
class SaleReportData:
    motorcycle: Any
    summary: CostSummary
    health: HealthScore
    fuel_summary: FuelUsageSummary
    maintenance_by_type: list[MaintenanceTypeSummaryRow]
    maintenance_history: list[MaintenanceHistoryRow]
    tire_history: list[TireHistoryRow]
    pressure_history: list[TirePressureHistoryRow]
    documents: list[DocumentSummaryRow]
    recent_events: list[TimelineEvent]


def _amount_sum(qs, field: str) -> Decimal:
    total = qs.aggregate(total=Sum(field))["total"]
    if total is None:
        return Decimal("0")
    return money_amount(total) or Decimal("0")


def _user_motorcycle_filter(user, motorcycle=None) -> dict[str, Any]:
    filters = {"motorcycle__owner": user, "motorcycle__is_active": True}
    if motorcycle:
        filters["motorcycle"] = motorcycle
    return filters


def _event_odometer_span(*, user, motorcycle=None, start: date | None = None, end: date | None = None) -> int:
    values: list[int] = []

    fuel = FuelRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    maintenance = MaintenanceRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    tires = TireRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    if start:
        fuel = fuel.filter(date__gte=start)
        maintenance = maintenance.filter(date__gte=start)
        tires = tires.filter(installed_at__gte=start)
    if end:
        fuel = fuel.filter(date__lte=end)
        maintenance = maintenance.filter(date__lte=end)
        tires = tires.filter(installed_at__lte=end)

    values.extend(fuel.values_list("odometer_km", flat=True))
    values.extend(maintenance.values_list("odometer_km", flat=True))
    values.extend(tires.values_list("installed_odometer_km", flat=True))
    values = [int(v or 0) for v in values if v is not None]
    if len(values) < 2:
        return 0
    return max(values) - min(values)


def cost_summary(*, user, motorcycle=None, start: date | None = None, end: date | None = None) -> CostSummary:
    fuel = FuelRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    maintenance = MaintenanceRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    tires = TireRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    fees = AnnualFee.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    policies = InsurancePolicy.objects.filter(**_user_motorcycle_filter(user, motorcycle))
    if start:
        fuel = fuel.filter(date__gte=start)
        maintenance = maintenance.filter(date__gte=start)
        tires = tires.filter(installed_at__gte=start)
        fees = fees.filter(due_date__gte=start)
        policies = policies.filter(coverage_start__gte=start)
    if end:
        fuel = fuel.filter(date__lte=end)
        maintenance = maintenance.filter(date__lte=end)
        tires = tires.filter(installed_at__lte=end)
        fees = fees.filter(due_date__lte=end)
        policies = policies.filter(coverage_start__lte=end)

    fuel_total = _amount_sum(fuel, "total_price")
    maintenance_total = _amount_sum(maintenance, "cost")
    tires_total = _amount_sum(tires, "cost")
    fees_total = _amount_sum(fees, "amount")
    insurance_total = _amount_sum(policies, "premium")
    total = fuel_total + maintenance_total + tires_total + fees_total + insurance_total
    distance = _event_odometer_span(user=user, motorcycle=motorcycle, start=start, end=end)
    cpk = (total / Decimal(distance)).quantize(Decimal("0.001")) if distance > 0 else None
    return CostSummary(fuel_total, maintenance_total, tires_total, fees_total, insurance_total, total, distance, cpk)


def period_comparisons(*, user, motorcycle=None, today: date | None = None) -> list[PeriodComparison]:
    today = today or timezone.localdate()
    rows: list[PeriodComparison] = []
    for days in PERIODS:
        start = today - timedelta(days=days - 1)
        summary = cost_summary(user=user, motorcycle=motorcycle, start=start, end=today)
        records = list(
            FuelRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle), date__gte=start, date__lte=today)
            .order_by("date", "odometer_km")
        )
        consumption = compute_average_consumption_km_per_liter(records)
        avg_consumption = consumption.km_per_liter if consumption else None
        if avg_consumption is None and summary.distance_km > 0:
            liters = (
                FuelRecord.objects.filter(**_user_motorcycle_filter(user, motorcycle), date__gte=start, date__lte=today)
                .aggregate(total=Sum("liters"))["total"]
                or Decimal("0")
            )
            if liters:
                avg_consumption = round(float(Decimal(summary.distance_km) / Decimal(liters)), 1)
        rows.append(
            PeriodComparison(
                days=days,
                start=start,
                end=today,
                total_cost=summary.total,
                distance_km=summary.distance_km,
                cost_per_km=summary.cost_per_km,
                average_consumption_km_l=avg_consumption,
            )
        )
    return rows


def monthly_real_costs(*, user, motorcycle=None, months: int = 6, today: date | None = None) -> list[dict[str, Any]]:
    today = today or timezone.localdate()
    rows: list[dict[str, Any]] = []
    cursor = date(today.year, today.month, 1)
    starts = []
    for _ in range(months):
        starts.append(cursor)
        cursor = date(cursor.year - 1, 12, 1) if cursor.month == 1 else date(cursor.year, cursor.month - 1, 1)
    for start in reversed(starts):
        end = (date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)) - timedelta(days=1)
        summary = cost_summary(user=user, motorcycle=motorcycle, start=start, end=min(end, today))
        rows.append({"label": start.strftime("%b").upper(), "summary": summary})
    return rows


def _average_km_between_fillups(records: list[FuelRecord]) -> int | None:
    ordered = sorted(records, key=lambda record: (record.date, int(record.odometer_km or 0), record.pk or 0))
    deltas = [
        int(current.odometer_km or 0) - int(previous.odometer_km or 0)
        for previous, current in zip(ordered, ordered[1:], strict=False)
    ]
    deltas = [delta for delta in deltas if delta > 0]
    if not deltas:
        return None
    return int(round(sum(deltas) / len(deltas)))


def _station_label(record: FuelRecord) -> str:
    if record.station and getattr(record.station, "name", None):
        return str(record.station.name).strip()
    return str(record.station_name or "").strip()


def _most_used_station(records: list[FuelRecord]) -> StationUsage | None:
    buckets: dict[str, dict[str, Decimal | int]] = {}
    for record in records:
        label = _station_label(record)
        if not label:
            continue
        bucket = buckets.setdefault(label, {"fillups_count": 0, "liters": Decimal("0"), "total_spend": Decimal("0")})
        bucket["fillups_count"] = int(bucket["fillups_count"]) + 1
        bucket["liters"] = Decimal(bucket["liters"]) + Decimal(record.liters or 0)
        bucket["total_spend"] = Decimal(bucket["total_spend"]) + (money_amount(record.total_price) or Decimal("0"))

    rows = [
        StationUsage(
            label=label,
            fillups_count=int(values["fillups_count"]),
            liters=Decimal(values["liters"]),
            total_spend=Decimal(values["total_spend"]),
        )
        for label, values in buckets.items()
    ]
    if not rows:
        return None
    return sorted(rows, key=lambda row: (-row.fillups_count, -row.liters, -row.total_spend, row.label))[0]


def _fuel_usage_summary(*, motorcycle) -> FuelUsageSummary:
    records = list(
        FuelRecord.objects.filter(motorcycle=motorcycle)
        .select_related("station", "fuel_grade")
        .order_by("date", "odometer_km", "pk")
    )
    liters_total = sum((Decimal(record.liters or 0) for record in records), Decimal("0"))
    total_spend = sum((money_amount(record.total_price) or Decimal("0") for record in records), Decimal("0"))
    return FuelUsageSummary(
        fillups_count=len(records),
        liters_total=liters_total,
        total_spend=total_spend,
        average_km_between_fillups=_average_km_between_fillups(records),
        most_used_station=_most_used_station(records),
    )


def _maintenance_history(*, motorcycle) -> list[MaintenanceHistoryRow]:
    return [
        MaintenanceHistoryRow(
            date=record.date,
            type_label=record.get_maintenance_type_display(),
            odometer_km=int(record.odometer_km or 0),
            cost=money_amount(record.cost) or Decimal("0"),
            workshop=record.workshop,
            description=record.description,
            parts_used=record.parts_used,
            next_change_km=record.computed_next_change_km,
            next_change_date=record.computed_next_change_date,
        )
        for record in MaintenanceRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")
    ]


def _maintenance_by_type(rows: list[MaintenanceHistoryRow]) -> list[MaintenanceTypeSummaryRow]:
    buckets: dict[str, dict[str, Any]] = {}
    for row in rows:
        bucket = buckets.setdefault(
            row.type_label,
            {"count": 0, "total_cost": Decimal("0"), "latest_date": row.date},
        )
        bucket["count"] += 1
        bucket["total_cost"] += row.cost
        bucket["latest_date"] = max(bucket["latest_date"], row.date)

    return sorted(
        (
            MaintenanceTypeSummaryRow(
                type_label=label,
                count=int(values["count"]),
                total_cost=Decimal(values["total_cost"]),
                latest_date=values["latest_date"],
            )
            for label, values in buckets.items()
        ),
        key=lambda row: (-row.total_cost, row.type_label),
    )


def _tire_history(*, motorcycle) -> list[TireHistoryRow]:
    return [
        TireHistoryRow(
            installed_at=record.installed_at,
            position_label=record.get_position_display(),
            brand_model=record.brand_model,
            installed_odometer_km=int(record.installed_odometer_km or 0),
            cost=money_amount(record.cost) or Decimal("0"),
            wear_percent=int(record.wear_percent or 0),
            is_active=bool(record.is_active),
        )
        for record in TireRecord.objects.filter(motorcycle=motorcycle).order_by("-installed_at", "-created_at")
    ]


def _pressure_history(*, motorcycle) -> list[TirePressureHistoryRow]:
    return [
        TirePressureHistoryRow(
            date=record.date,
            psi_front=int(record.psi_front or 0),
            psi_rear=int(record.psi_rear or 0),
            notes=record.notes,
        )
        for record in TirePressureRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-created_at")[:12]
    ]


def _document_summary(*, motorcycle) -> list[DocumentSummaryRow]:
    return [
        DocumentSummaryRow(
            name=document.name,
            type_label=document.get_document_type_display(),
            valid_until=document.valid_until,
        )
        for document in MotorcycleDocument.objects.filter(motorcycle=motorcycle).order_by("name")
    ]


def sale_report_data(*, motorcycle) -> SaleReportData:
    maintenance_history = _maintenance_history(motorcycle=motorcycle)
    return SaleReportData(
        motorcycle=motorcycle,
        summary=cost_summary(user=motorcycle.owner, motorcycle=motorcycle),
        health=health_score(motorcycle=motorcycle),
        fuel_summary=_fuel_usage_summary(motorcycle=motorcycle),
        maintenance_by_type=_maintenance_by_type(maintenance_history),
        maintenance_history=maintenance_history,
        tire_history=_tire_history(motorcycle=motorcycle),
        pressure_history=_pressure_history(motorcycle=motorcycle),
        documents=_document_summary(motorcycle=motorcycle),
        recent_events=timeline_events(user=motorcycle.owner, motorcycle=motorcycle)[:12],
    )


def infer_riding_profile(*, motorcycle, today: date | None = None) -> str:
    if not motorcycle:
        return "auto"
    manual = getattr(motorcycle, "riding_profile", "auto")
    if manual and manual != "auto":
        return manual

    today = today or timezone.localdate()
    year_ago = today - timedelta(days=365)
    qs = FuelRecord.objects.filter(motorcycle=motorcycle, date__gte=year_ago).order_by("date", "odometer_km")
    span = qs.aggregate(min_odo=Min("odometer_km"), max_odo=Max("odometer_km"))
    distance = max(int(span["max_odo"] or 0) - int(span["min_odo"] or 0), 0)
    km_month = distance / 12 if distance else 0
    records = list(qs)
    consumption = compute_average_consumption_km_per_liter(records)

    if km_month >= 1400:
        return "highway"
    if km_month <= 250:
        return "urban"
    if consumption and consumption.km_per_liter < 18:
        return "severe"
    return "mixed"


def maintenance_recommendations(*, motorcycle, today: date | None = None) -> list[dict[str, Any]]:
    if not motorcycle:
        return []
    today = today or timezone.localdate()
    current = int(motorcycle.current_odometer_km or 0)
    profile = infer_riding_profile(motorcycle=motorcycle, today=today)
    factor = {"severe": Decimal("0.75"), "urban": Decimal("0.90"), "mixed": Decimal("1.00"), "highway": Decimal("1.10")}.get(
        profile, Decimal("1.00")
    )
    rows = []
    for item in MaintenancePlanItem.objects.filter(motorcycle=motorcycle, is_active=True):
        interval_km = int(Decimal(item.interval_km or 0) * factor) if item.interval_km else None
        due_km = (int(item.last_done_km) + interval_km) if item.last_done_km is not None and interval_km else None
        remaining_km = due_km - current if due_km is not None else None
        due_date = item.last_done_date + timedelta(days=item.interval_days) if item.last_done_date and item.interval_days else None
        remaining_days = (due_date - today).days if due_date else None
        severity = Severity.INFO
        if (remaining_km is not None and remaining_km <= 0) or (remaining_days is not None and remaining_days <= 0):
            severity = Severity.CRITICAL
        elif (remaining_km is not None and remaining_km <= 300) or (remaining_days is not None and remaining_days <= 14):
            severity = Severity.WARNING
        rows.append(
            {
                "label": item.get_maintenance_type_display(),
                "profile": profile,
                "due_km": due_km,
                "due_date": due_date,
                "remaining_km": remaining_km,
                "remaining_days": remaining_days,
                "severity": severity,
            }
        )
    return sorted(rows, key=lambda row: SEVERITY_PRIORITY.get(row["severity"], 99))[:5]


def intelligent_alerts(*, user, motorcycle=None, severity: str | None = None) -> list[Alert]:
    today = timezone.localdate()
    alerts: list[Alert] = []
    motorcycles = [motorcycle] if motorcycle else []
    if not motorcycles:
        from apps.garage.models import Motorcycle

        motorcycles = list(Motorcycle.objects.filter(owner=user, is_active=True))

    for bike in motorcycles:
        current = int(bike.current_odometer_km or 0)
        for reminder in Reminder.objects.filter(motorcycle=bike, is_active=True):
            evaluation = evaluate_reminder(reminder, current_odometer_km=current, today=today)
            if evaluation.status == ReminderStatus.OVERDUE:
                alerts.append(Alert(reminder.title, "Lembrete vencido.", Severity.CRITICAL, "reminder", evaluation.due_date))
            elif evaluation.status == ReminderStatus.DUE_SOON:
                alerts.append(Alert(reminder.title, "Lembrete próximo do vencimento.", Severity.WARNING, "reminder", evaluation.due_date))

        for rec in FuelRecord.objects.filter(motorcycle=bike).order_by("-date", "-odometer_km")[:1]:
            warnings = detect_fuel_anomalies(
                history_qs=FuelRecord.objects.filter(motorcycle=bike).exclude(pk=rec.pk),
                odometer_km=rec.odometer_km,
                liters=rec.liters,
                price_per_liter=rec.price_per_liter,
            )
            for warning in warnings:
                alerts.append(Alert("Qualidade do abastecimento", warning, Severity.INFO, "fuel", rec.date))

        fuel_history = FuelRecord.objects.filter(motorcycle=bike).order_by("date", "odometer_km")
        next_fill = estimate_next_fill_up(fuel_history)
        if next_fill and next_fill.remaining_km <= 200:
            alerts.append(
                Alert(
                    "Próximo abastecimento",
                    f"Próximo abastecimento recomendado em {next_fill.recommended_odometer_km} km.",
                    Severity.WARNING if next_fill.remaining_km <= 50 else Severity.INFO,
                    "fuel",
                    None,
                    reverse("fuel:list"),
                )
            )

        review = review_suggestion_for_motorcycle(bike)
        if review.is_due:
            alerts.append(
                Alert(
                    "Revisão sugerida",
                    f"Sugerir revisão: {review.fillups_since_review} abastecimentos desde a última revisão.",
                    Severity.WARNING,
                    "maintenance",
                    None,
                    reverse("maintenance:list"),
                )
            )

        for tire in TireRecord.objects.filter(motorcycle=bike, is_active=True):
            if int(tire.wear_percent or 0) >= 85:
                alerts.append(Alert(f"Pneu {tire.get_position_display()}", "Desgaste crítico.", Severity.CRITICAL, "tires", tire.installed_at))
            elif int(tire.wear_percent or 0) >= 70:
                alerts.append(Alert(f"Pneu {tire.get_position_display()}", "Desgaste pede atenção.", Severity.WARNING, "tires", tire.installed_at))

        for doc in MotorcycleDocument.objects.filter(motorcycle=bike, valid_until__isnull=False):
            remaining = (doc.valid_until - today).days
            if remaining < 0:
                alerts.append(Alert(doc.name, "Documento vencido.", Severity.CRITICAL, "documents", doc.valid_until))
            elif remaining <= 30:
                alerts.append(Alert(doc.name, "Documento vence em até 30 dias.", Severity.WARNING, "documents", doc.valid_until))

        for fee in AnnualFee.objects.filter(motorcycle=bike, paid_date__isnull=True):
            remaining = (fee.due_date - today).days
            if remaining < 0:
                alerts.append(Alert(str(fee), "Taxa vencida.", Severity.CRITICAL, "expenses", fee.due_date))
            elif remaining <= int(fee.notify_before_days or 30):
                alerts.append(Alert(str(fee), "Taxa próxima do vencimento.", Severity.WARNING, "expenses", fee.due_date))

        for policy in InsurancePolicy.objects.filter(motorcycle=bike):
            remaining = (policy.coverage_end - today).days
            if remaining < 0:
                alerts.append(Alert(str(policy), "Seguro vencido.", Severity.CRITICAL, "expenses", policy.coverage_end))
            elif remaining <= int(policy.notify_before_days or 30):
                alerts.append(Alert(str(policy), "Seguro próximo do fim da vigência.", Severity.WARNING, "expenses", policy.coverage_end))

    if severity:
        alerts = [a for a in alerts if a.severity == severity]
    return sorted(alerts, key=lambda a: (a.priority, a.date or today, a.title))


def timeline_events(*, user, motorcycle=None, start: date | None = None, end: date | None = None, source: str = "", severity: str = "") -> list[TimelineEvent]:
    events: list[TimelineEvent] = []
    filters = _user_motorcycle_filter(user, motorcycle)

    def in_range(value: date) -> bool:
        return (start is None or value >= start) and (end is None or value <= end)

    for r in FuelRecord.objects.filter(**filters).select_related("motorcycle", "station"):
        if in_range(r.date):
            events.append(TimelineEvent(r.date, "fuel", "Abastecimento", r.station_name or "Abastecimento", f"{r.liters} L - {r.odometer_km} km", money_amount(r.total_price), r.odometer_km, Severity.INFO, reverse("fuel:list")))
    for r in MaintenanceRecord.objects.filter(**filters).select_related("motorcycle"):
        if in_range(r.date):
            sev = Severity.INFO if not (r.interval_km or r.interval_days) else Severity.SUCCESS
            events.append(TimelineEvent(r.date, "maintenance", "Manutenção", r.get_maintenance_type_display(), f"{r.odometer_km} km", money_amount(r.cost), r.odometer_km, sev, reverse("maintenance:list")))
    for r in TireRecord.objects.filter(**filters).select_related("motorcycle"):
        if in_range(r.installed_at):
            sev = Severity.WARNING if int(r.wear_percent or 0) >= 70 else Severity.INFO
            events.append(TimelineEvent(r.installed_at, "tires", "Pneu", f"{r.get_position_display()} - {r.brand_model}", f"{r.installed_odometer_km} km", money_amount(r.cost), r.installed_odometer_km, sev, reverse("tires:list")))
    for d in MotorcycleDocument.objects.filter(**filters).select_related("motorcycle"):
        event_date = d.valid_until or d.created_at.date()
        if in_range(event_date):
            sev = Severity.WARNING if d.valid_until and d.valid_until <= timezone.localdate() + timedelta(days=30) else Severity.INFO
            events.append(TimelineEvent(event_date, "documents", "Documento", d.name, d.get_document_type_display(), None, None, sev, reverse("documents:list")))
    for fee in AnnualFee.objects.filter(**filters):
        if in_range(fee.due_date):
            sev = Severity.CRITICAL if not fee.paid_date and fee.due_date < timezone.localdate() else Severity.INFO
            events.append(TimelineEvent(fee.due_date, "expenses", "Taxa", fee.get_fee_type_display(), str(fee.year), money_amount(fee.amount), None, sev, reverse("expenses:list")))
    for policy in InsurancePolicy.objects.filter(**filters):
        if in_range(policy.coverage_end):
            sev = Severity.CRITICAL if policy.coverage_end < timezone.localdate() else Severity.INFO
            events.append(TimelineEvent(policy.coverage_end, "expenses", "Seguro", policy.provider, "Fim da vigência", money_amount(policy.premium), None, sev, reverse("expenses:list")))

    if source:
        events = [e for e in events if e.source == source]
    if severity:
        events = [e for e in events if e.severity == severity]
    return sorted(events, key=lambda e: (e.date, e.priority), reverse=True)


def health_score(*, motorcycle) -> HealthScore:
    if not motorcycle:
        return HealthScore(0, 0, 0, 0, 0, ["Sem moto ativa."])

    alerts = intelligent_alerts(user=motorcycle.owner, motorcycle=motorcycle)
    critical = len([a for a in alerts if a.severity == Severity.CRITICAL])
    warning = len([a for a in alerts if a.severity == Severity.WARNING])
    notes: list[str] = []

    recs = maintenance_recommendations(motorcycle=motorcycle)
    maint_penalty = min(35, len([r for r in recs if r["severity"] == Severity.CRITICAL]) * 18 + len([r for r in recs if r["severity"] == Severity.WARNING]) * 8)
    maintenance = max(0, 35 - maint_penalty)
    if maint_penalty:
        notes.append("Há manutenção vencida ou próxima.")

    active_tires = list(TireRecord.objects.filter(motorcycle=motorcycle, is_active=True))
    tire_penalty = 25 if not active_tires else min(25, sum(12 if int(t.wear_percent or 0) >= 85 else 6 if int(t.wear_percent or 0) >= 70 else 0 for t in active_tires))
    tires = max(0, 25 - tire_penalty)
    if tire_penalty:
        notes.append("Revise pneus ativos.")

    doc_alerts = [a for a in alerts if a.source in {"documents", "expenses"}]
    documents = max(0, 20 - min(20, len([a for a in doc_alerts if a.severity == Severity.CRITICAL]) * 10 + len([a for a in doc_alerts if a.severity == Severity.WARNING]) * 5))
    if documents < 20:
        notes.append("Há documentos, taxas ou seguros para revisar.")

    data_quality = max(0, 20 - min(20, critical * 5 + warning * 2))
    if data_quality < 20:
        notes.append("Existem alertas que afetam a qualidade dos dados.")

    total = maintenance + tires + documents + data_quality
    if not notes:
        notes.append("Moto com registros em bom estado.")
    return HealthScore(total=total, maintenance=maintenance, tires=tires, documents=documents, data_quality=data_quality, notes=notes)
