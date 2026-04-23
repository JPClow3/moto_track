from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db import DatabaseError, transaction
from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Q, QuerySet, StdDev, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from djmoney.money import Money

from .models import FuelPreference, FuelRecord, FuelReviewPreference


@dataclass(frozen=True)
class ConsumptionStats:
    km_per_liter: float
    segments_used: int


@dataclass(frozen=True)
class NextFillUpEstimate:
    recommended_odometer_km: int
    remaining_km: int
    average_full_tank_distance_km: int


@dataclass(frozen=True)
class FuelPeriodSummary:
    total_spend: Decimal
    total_liters: Decimal
    distance_km: int
    cost_per_km: Decimal | None
    official_consumption_km_l: float | None
    provisional_consumption_km_l: float | None
    official_liters_per_100km: float | None
    next_fill_up: NextFillUpEstimate | None


@dataclass(frozen=True)
class FuelReviewSuggestion:
    is_due: bool
    fillups_since_review: int
    interval: int
    remaining_fillups: int


def compute_average_consumption_km_per_liter(records: Iterable[FuelRecord]) -> ConsumptionStats | None:
    """
    Compute average consumption using only intervals between full-tank events.

    We use `tank_full=True` as anchors; partial fills between anchors are included.
    If there are fewer than 2 full anchors, returns None.
    """
    all_records = sorted(records, key=lambda r: (r.date, r.odometer_km, r.pk or 0))
    if sum(1 for r in all_records if r.tank_full) < 2:
        return None

    total_distance = 0
    total_liters = Decimal("0")
    segments = 0
    previous_full: FuelRecord | None = None
    segment_liters = Decimal("0")

    for record in all_records:
        if previous_full is None:
            if record.tank_full:
                previous_full = record
                segment_liters = Decimal("0")
            continue

        segment_liters += Decimal(record.liters or 0)
        if not record.tank_full:
            continue

        distance = record.odometer_km - previous_full.odometer_km
        if distance > 0 and segment_liters > 0:
            total_distance += distance
            total_liters += segment_liters
            segments += 1

        previous_full = record
        segment_liters = Decimal("0")

    if segments == 0 or total_liters <= 0 or total_distance <= 0:
        return None

    km_per_liter = float(Decimal(total_distance) / total_liters)
    return ConsumptionStats(km_per_liter=round(km_per_liter, 1), segments_used=segments)


def _ordered_records(records: Iterable[FuelRecord]) -> list[FuelRecord]:
    return sorted(records, key=lambda r: (r.date, r.odometer_km, r.pk or 0))


def _provisional_consumption_km_l(records: Iterable[FuelRecord]) -> float | None:
    ordered = _ordered_records(records)
    last_full = None
    for record in ordered:
        if record.tank_full:
            last_full = record
    if last_full is None:
        return None

    open_records = [
        r
        for r in ordered
        if (r.date, r.odometer_km, r.pk or 0) > (last_full.date, last_full.odometer_km, last_full.pk or 0)
    ]
    if not open_records:
        return None

    latest = open_records[-1]
    distance = latest.odometer_km - last_full.odometer_km
    liters = sum((Decimal(r.liters or 0) for r in open_records), Decimal("0"))
    if distance <= 0 or liters <= 0:
        return None
    return round(float(Decimal(distance) / liters), 1)


def estimate_next_fill_up(records: Iterable[FuelRecord]) -> NextFillUpEstimate | None:
    ordered = _ordered_records(records)
    full_records = [r for r in ordered if r.tank_full]
    if len(full_records) < 2:
        return None

    distances = []
    for previous, current in zip(full_records, full_records[1:], strict=False):
        distance = current.odometer_km - previous.odometer_km
        if distance > 0:
            distances.append(distance)
    if not distances:
        return None

    avg_distance = int(round(sum(distances) / len(distances)))
    last_full = full_records[-1]
    latest = ordered[-1]
    recommended = last_full.odometer_km + avg_distance
    remaining = max(recommended - latest.odometer_km, 0)
    return NextFillUpEstimate(
        recommended_odometer_km=recommended,
        remaining_km=remaining,
        average_full_tank_distance_km=avg_distance,
    )


def build_fuel_period_summary(records: Iterable[FuelRecord]) -> FuelPeriodSummary:
    ordered = _ordered_records(records)
    total_spend = sum((_money_amount(r.total_price) or Decimal("0") for r in ordered), Decimal("0"))
    total_liters = sum((Decimal(r.liters or 0) for r in ordered), Decimal("0"))
    odometers = [int(r.odometer_km or 0) for r in ordered if r.odometer_km is not None]
    distance = max(odometers) - min(odometers) if len(odometers) >= 2 else 0
    cost_per_km = (total_spend / Decimal(distance)).quantize(Decimal("0.001")) if distance > 0 else None
    official = compute_average_consumption_km_per_liter(ordered)
    official_km_l = official.km_per_liter if official else None
    official_l_100 = round(100 / official_km_l, 2) if official_km_l else None
    return FuelPeriodSummary(
        total_spend=total_spend,
        total_liters=total_liters,
        distance_km=distance,
        cost_per_km=cost_per_km,
        official_consumption_km_l=official_km_l,
        provisional_consumption_km_l=_provisional_consumption_km_l(ordered),
        official_liters_per_100km=official_l_100,
        next_fill_up=estimate_next_fill_up(ordered),
    )


def filter_fuel_records_for_user(
    *,
    user,
    start: date | None = None,
    end: date | None = None,
    motorcycle_id: str | int | None = None,
    station_id: str | int | None = None,
    fuel_type: str = "",
) -> QuerySet[FuelRecord]:
    qs = (
        FuelRecord.objects.filter(motorcycle__owner=user, motorcycle__is_active=True)
        .select_related("motorcycle", "station", "fuel_grade")
        .order_by("-date", "-odometer_km")
    )
    if start:
        qs = qs.filter(date__gte=start)
    if end:
        qs = qs.filter(date__lte=end)
    if motorcycle_id:
        qs = qs.filter(motorcycle_id=motorcycle_id)
    if station_id:
        qs = qs.filter(station_id=station_id)
    if fuel_type:
        qs = qs.filter(fuel_type=fuel_type)
    return qs


def review_suggestion_for_motorcycle(motorcycle) -> FuelReviewSuggestion:
    try:
        preference = motorcycle.fuel_review_preference
    except FuelReviewPreference.DoesNotExist:
        preference = FuelReviewPreference(motorcycle=motorcycle)
    interval = int(preference.fillups_interval or 10)
    if not preference.is_active:
        return FuelReviewSuggestion(False, 0, interval, interval)

    from apps.maintenance.models import MaintenanceRecord, MaintenanceType

    latest_review = (
        MaintenanceRecord.objects.filter(motorcycle=motorcycle, maintenance_type=MaintenanceType.REVIEW)
        .order_by("-date", "-odometer_km")
        .first()
    )
    qs = FuelRecord.objects.filter(motorcycle=motorcycle)
    if latest_review:
        qs = qs.filter(date__gte=latest_review.date).exclude(date=latest_review.date, odometer_km__lte=latest_review.odometer_km)
    count = qs.count()
    remaining = max(interval - count, 0)
    return FuelReviewSuggestion(
        is_due=count >= interval,
        fillups_since_review=count,
        interval=interval,
        remaining_fillups=remaining,
    )


def review_suggestion_from_history(
    *,
    motorcycle,
    fuel_records: Iterable[FuelRecord],
    review_records: Iterable,
) -> FuelReviewSuggestion:
    try:
        preference = motorcycle.fuel_review_preference
    except FuelReviewPreference.DoesNotExist:
        preference = FuelReviewPreference(motorcycle=motorcycle)
    interval = int(preference.fillups_interval or 10)
    if not preference.is_active:
        return FuelReviewSuggestion(False, 0, interval, interval)

    latest_review = None
    for record in review_records:
        record_key = (record.date, record.odometer_km, record.pk or 0)
        if latest_review is None or record_key > (latest_review.date, latest_review.odometer_km, latest_review.pk or 0):
            latest_review = record

    count = 0
    for record in fuel_records:
        if latest_review and (record.date, record.odometer_km) <= (latest_review.date, latest_review.odometer_km):
            continue
        count += 1

    remaining = max(interval - count, 0)
    return FuelReviewSuggestion(
        is_due=count >= interval,
        fillups_since_review=count,
        interval=interval,
        remaining_fillups=remaining,
    )


def _money_amount(value) -> Decimal | None:
    if value is None:
        return None
    if hasattr(value, "amount"):
        return Decimal(str(value.amount))
    return Decimal(str(value))


def detect_fuel_anomalies(
    *,
    history_qs: QuerySet[FuelRecord],
    odometer_km: int,
    liters: Decimal,
    price_per_liter: Money | Decimal | None,
) -> list[str]:
    """
    Lightweight anomaly detection for fuel records.

    Returns human-friendly warning strings. It MUST NOT block saves.
    """
    warnings: list[str] = []

    last = history_qs.order_by("-date", "-odometer_km").first()
    if last and odometer_km <= int(last.odometer_km or 0):
        warnings.append("Odômetro menor/igual ao último abastecimento registrado.")

    # Price/L outlier vs last N
    price_amt = _money_amount(price_per_liter)
    if price_amt is not None and price_amt > 0:
        recent_prices: list[Decimal] = []
        for r in history_qs.order_by("-date", "-odometer_km")[:10]:
            amt = _money_amount(r.price_per_liter)
            if amt is not None and amt > 0:
                recent_prices.append(amt)
        if len(recent_prices) >= 5:
            mean = sum(recent_prices) / Decimal(len(recent_prices))
            if mean > 0:
                ratio = price_amt / mean
                if ratio >= Decimal("1.30") or ratio <= Decimal("0.70"):
                    warnings.append("Preço/L muito fora da sua média recente.")

    # Consumption outlier using simple per-interval liters/100km vs last N intervals
    if last:
        distance = int(odometer_km) - int(last.odometer_km or 0)
        if distance > 0 and liters and Decimal(liters) > 0:
            current_l_per_100 = (Decimal(liters) / Decimal(distance)) * Decimal("100")
            intervals: list[Decimal] = []
            recent = list(history_qs.order_by("-date", "-odometer_km")[:12])
            for a, b in zip(recent, recent[1:], strict=False):
                d = int(a.odometer_km or 0) - int(b.odometer_km or 0)
                if d <= 0:
                    continue
                if not a.liters:
                    continue
                intervals.append((Decimal(a.liters) / Decimal(d)) * Decimal("100"))
            if len(intervals) >= 5:
                mean = sum(intervals) / Decimal(len(intervals))
                if mean > 0:
                    ratio = current_l_per_100 / mean
                    if ratio >= Decimal("1.40") or ratio <= Decimal("0.60"):
                        warnings.append("Consumo (L/100km) fora do padrão recente.")

    return warnings


def detect_fuel_anomalies_from_history(
    *,
    history_records: Iterable[FuelRecord],
    odometer_km: int,
    liters: Decimal,
    price_per_liter: Money | Decimal | None,
) -> list[str]:
    """In-memory variant for callers that already prefetched fuel history."""
    warnings: list[str] = []
    recent = sorted(history_records, key=lambda r: (r.date, r.odometer_km, r.pk or 0), reverse=True)
    last = recent[0] if recent else None
    if last and odometer_km <= int(last.odometer_km or 0):
        warnings.append("Odômetro menor/igual ao último abastecimento registrado.")

    price_amt = _money_amount(price_per_liter)
    if price_amt is not None and price_amt > 0:
        recent_prices = [
            amt
            for amt in (_money_amount(r.price_per_liter) for r in recent[:10])
            if amt is not None and amt > 0
        ]
        if len(recent_prices) >= 5:
            mean = sum(recent_prices) / Decimal(len(recent_prices))
            if mean > 0:
                ratio = price_amt / mean
                if ratio >= Decimal("1.30") or ratio <= Decimal("0.70"):
                    warnings.append("Preço/L muito fora da sua média recente.")

    if last:
        distance = int(odometer_km) - int(last.odometer_km or 0)
        if distance > 0 and liters and Decimal(liters) > 0:
            current_l_per_100 = (Decimal(liters) / Decimal(distance)) * Decimal("100")
            intervals: list[Decimal] = []
            for a, b in zip(recent[:12], recent[1:12], strict=False):
                d = int(a.odometer_km or 0) - int(b.odometer_km or 0)
                if d <= 0 or not a.liters:
                    continue
                intervals.append((Decimal(a.liters) / Decimal(d)) * Decimal("100"))
            if len(intervals) >= 5:
                mean = sum(intervals) / Decimal(len(intervals))
                if mean > 0:
                    ratio = current_l_per_100 / mean
                    if ratio >= Decimal("1.40") or ratio <= Decimal("0.60"):
                        warnings.append("Consumo (L/100km) fora do padrão recente.")

    return warnings


@dataclass(frozen=True)
class StationRankingRow:
    station_label: str
    samples: int
    avg_price_per_liter: Decimal | None
    std_price_per_liter: Decimal | None
    weighted_avg_price_per_liter: Decimal | None


def _compute_station_rankings_python(records: Iterable[FuelRecord]) -> list[StationRankingRow]:
    """
    Compute simple station rankings from a set of FuelRecords.

    The caller is responsible for scoping records to the current user.
    """
    buckets: dict[str, list[FuelRecord]] = {}
    for r in records:
        label = ""
        if r.station and getattr(r.station, "name", None):
            label = str(r.station.name)
        elif r.station_name:
            label = str(r.station_name)
        label = label.strip()
        if not label:
            continue
        buckets.setdefault(label, []).append(r)

    rows: list[StationRankingRow] = []
    for label, items in buckets.items():
        prices: list[Decimal] = []
        weighted_sum = Decimal("0")
        liters_sum = Decimal("0")
        for r in items:
            amt = _money_amount(r.price_per_liter)
            if amt is not None and amt > 0:
                prices.append(amt)
                liters = Decimal(str(r.liters or 0))
                if liters > 0:
                    weighted_sum += amt * liters
                    liters_sum += liters

        if not prices:
            rows.append(
                StationRankingRow(
                    station_label=label,
                    samples=len(items),
                    avg_price_per_liter=None,
                    std_price_per_liter=None,
                    weighted_avg_price_per_liter=None,
                )
            )
            continue

        mean = sum(prices) / Decimal(len(prices))
        std = None
        if len(prices) >= 2:
            var = sum((p - mean) ** 2 for p in prices) / Decimal(len(prices))
            std = var.sqrt()

        weighted = (weighted_sum / liters_sum) if liters_sum > 0 else None
        rows.append(
            StationRankingRow(
                station_label=label,
                samples=len(prices),
                avg_price_per_liter=mean,
                std_price_per_liter=std,
                weighted_avg_price_per_liter=weighted,
            )
        )

    return rows


def compute_station_rankings(records: QuerySet[FuelRecord]) -> list[StationRankingRow]:
    """
    Compute station rankings with SQL aggregation.

    The caller is responsible for scoping records to the current user.
    """
    weighted_expression = ExpressionWrapper(
        F("price_per_liter") * F("liters"),
        output_field=DecimalField(max_digits=18, decimal_places=6),
    )
    weighted_filter = Q(price_per_liter__isnull=False, liters__isnull=False, liters__gt=0)
    try:
        aggregated = (
            records.annotate(station_label=Coalesce("station__name", "station_name"))
            .exclude(station_label="")
            .values("station_label")
            .annotate(
                samples=Count("price_per_liter"),
                avg_price=Avg("price_per_liter"),
                std_price=StdDev("price_per_liter"),
                weighted_sum=Sum(weighted_expression, filter=weighted_filter),
                liters_sum=Sum("liters", filter=weighted_filter),
            )
        )
        rows: list[StationRankingRow] = []
        for row in aggregated:
            liters_sum = Decimal(row["liters_sum"] or 0)
            weighted = (Decimal(row["weighted_sum"] or 0) / liters_sum) if liters_sum > 0 else None
            rows.append(
                StationRankingRow(
                    station_label=row["station_label"],
                    samples=int(row["samples"] or 0),
                    avg_price_per_liter=Decimal(row["avg_price"]) if row["avg_price"] is not None else None,
                    std_price_per_liter=Decimal(row["std_price"]) if row["std_price"] is not None else None,
                    weighted_avg_price_per_liter=weighted,
                )
            )
        return rows
    except DatabaseError:
        return _compute_station_rankings_python(records)


def _month_key(dt):
    return (dt.year, dt.month)


def months_back(reference_date, count: int) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    year = reference_date.year
    month = reference_date.month
    for _ in range(count):
        months.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    months.reverse()
    return months


def format_month_label(year: int, month: int) -> str:
    return timezone.datetime(year, month, 1).strftime("%b").upper()


def moving_average(series: list[float | None], window: int) -> list[float | None]:
    out: list[float | None] = []
    for idx in range(len(series)):
        start = max(0, idx - window + 1)
        chunk = [v for v in series[start : idx + 1] if v is not None]
        out.append(round(sum(chunk) / len(chunk), 3) if chunk else None)
    return out


def monthly_fuel_trend(records_qs: QuerySet[FuelRecord], *, months_count: int = 6, today=None) -> dict:
    today = today or timezone.localdate()
    months = months_back(today, months_count)
    start_year, start_month = months[0]
    start_date = timezone.datetime(start_year, start_month, 1).date()
    buckets = {
        month: {"liters": 0.0, "min_odo": None, "max_odo": None, "total": Decimal("0"), "count": 0}
        for month in months
    }

    for row in records_qs.filter(date__gte=start_date).values("date", "liters", "odometer_km", "total_price"):
        key = _month_key(row["date"])
        if key not in buckets:
            continue
        bucket = buckets[key]
        bucket["count"] += 1
        bucket["liters"] += float(row["liters"] or 0)
        total = row["total_price"]
        total_amount = getattr(total, "amount", total) or 0
        bucket["total"] += Decimal(str(total_amount))
        odo = row["odometer_km"]
        bucket["min_odo"] = odo if bucket["min_odo"] is None else min(bucket["min_odo"], odo)
        bucket["max_odo"] = odo if bucket["max_odo"] is None else max(bucket["max_odo"], odo)

    trend_points = []
    trend_values = []
    cost_points = []
    cost_values = []
    for year, month in months:
        bucket = buckets[(year, month)]
        span = (
            bucket["max_odo"] - bucket["min_odo"]
            if bucket["min_odo"] is not None and bucket["max_odo"] is not None
            else 0
        )
        value = None
        if span > 0 and bucket["count"] > 0:
            value = round(bucket["liters"] / span * 100, 2)
            trend_values.append(value)
        label = format_month_label(year, month)
        trend_points.append({"label": label, "value": value, "has_value": value is not None, "bar_percent": 0})

        cost_value = None
        if span > 0 and bucket["count"] > 0:
            cost_value = round(float(bucket["total"]) / span, 3)
            cost_values.append(cost_value)
        cost_points.append({"label": label, "value": cost_value, "has_value": cost_value is not None, "bar_percent": 0})

    trend_max = max(trend_values) if trend_values else None
    cost_max = max(cost_values) if cost_values else None
    for point in trend_points:
        if trend_max and point["value"] is not None:
            point["bar_percent"] = round((point["value"] / trend_max) * 100, 2)
    for point in cost_points:
        if cost_max and point["value"] is not None:
            point["bar_percent"] = round((point["value"] / cost_max) * 100, 2)

    return {
        "trend_points": trend_points,
        "trend_max": trend_max,
        "trend_ma": moving_average([p["value"] for p in trend_points], 3),
        "cost_points": cost_points,
        "cost_max": cost_max,
        "cost_ma": moving_average([p["value"] for p in cost_points], 3),
    }


def best_fuel_preference(*, user, motorcycle=None) -> FuelPreference | None:
    qs = FuelPreference.objects.filter(owner=user).order_by("-use_count", "-last_used_at", "-updated_at")
    if motorcycle:
        qs = qs.filter(motorcycle__in=[motorcycle, None])
    return qs.first()


def remember_fuel_preference(record: FuelRecord) -> FuelPreference:
    station_name = record.station_name or (record.station.name if record.station else "")
    lookup = {
        "owner": record.motorcycle.owner,
        "motorcycle": record.motorcycle,
        "station": record.station,
        "fuel_grade": record.fuel_grade,
        "fuel_type": record.fuel_type,
        "station_name": station_name,
    }
    with transaction.atomic():
        preference, _ = FuelPreference.objects.select_for_update().get_or_create(
            **lookup,
            defaults={
                "price_per_liter": record.price_per_liter,
                "tank_full": record.tank_full,
                "use_count": 0,
            },
        )
        FuelPreference.objects.filter(pk=preference.pk).update(
            price_per_liter=record.price_per_liter,
            tank_full=record.tank_full,
            use_count=F("use_count") + 1,
            last_used_at=timezone.now(),
        )
        preference.refresh_from_db()
    return preference
