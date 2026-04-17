from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import Decimal

from django.utils import timezone
from django.db.models import QuerySet
from djmoney.money import Money

from .models import FuelPreference, FuelRecord


@dataclass(frozen=True)
class ConsumptionStats:
    km_per_liter: float
    segments_used: int


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


def _money_amount(value) -> Decimal | None:
    if value is None:
        return None
    if hasattr(value, "amount"):
        return Decimal(str(getattr(value, "amount")))
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


@dataclass(frozen=True)
class StationRankingRow:
    station_label: str
    samples: int
    avg_price_per_liter: Decimal | None
    std_price_per_liter: Decimal | None
    weighted_avg_price_per_liter: Decimal | None


def compute_station_rankings(records: Iterable[FuelRecord]) -> list[StationRankingRow]:
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


## NOTE: Station ranking helpers are defined once above.


def best_fuel_preference(*, user, motorcycle=None) -> FuelPreference | None:
    qs = FuelPreference.objects.filter(owner=user).order_by("-use_count", "-last_used_at", "-updated_at")
    if motorcycle:
        qs = qs.filter(motorcycle__in=[motorcycle, None])
    return qs.first()


def remember_fuel_preference(record: FuelRecord) -> FuelPreference:
    station_name = record.station_name or (record.station.name if record.station else "")
    preference = (
        FuelPreference.objects.filter(
            owner=record.motorcycle.owner,
            motorcycle=record.motorcycle,
            station=record.station,
            fuel_grade=record.fuel_grade,
            fuel_type=record.fuel_type,
            station_name=station_name,
        )
        .order_by("-updated_at")
        .first()
    )
    if preference is None:
        preference = FuelPreference(
            owner=record.motorcycle.owner,
            motorcycle=record.motorcycle,
            station=record.station,
            fuel_grade=record.fuel_grade,
            fuel_type=record.fuel_type,
            station_name=station_name,
        )
    preference.price_per_liter = record.price_per_liter
    preference.tank_full = record.tank_full
    preference.use_count = int(preference.use_count or 0) + 1
    preference.last_used_at = timezone.now()
    preference.save()
    return preference
