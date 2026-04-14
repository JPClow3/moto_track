from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, Optional

from .models import FuelRecord


@dataclass(frozen=True)
class ConsumptionStats:
    km_per_liter: float
    segments_used: int


def compute_average_consumption_km_per_liter(records: Iterable[FuelRecord]) -> Optional[ConsumptionStats]:
    """
    Compute average consumption using only intervals between full-tank events.

    We use `tank_full=True` as anchors; partial fills between anchors are included.
    If there are fewer than 2 full anchors, returns None.
    """
    all_records = list(records)
    full = [r for r in all_records if r.tank_full]
    if len(full) < 2:
        return None

    # Ensure chronological order
    full.sort(key=lambda r: (r.date, r.odometer_km))

    total_distance = 0
    total_liters = Decimal("0")
    segments = 0

    for prev, nxt in zip(full, full[1:]):
        distance = nxt.odometer_km - prev.odometer_km
        if distance <= 0:
            continue

        # Liters purchased AFTER the previous full up to and including the next full.
        segment_liters = sum(
            (
                r.liters
                for r in all_records
                if (r.date, r.odometer_km) > (prev.date, prev.odometer_km)
                and (r.date, r.odometer_km) <= (nxt.date, nxt.odometer_km)
            ),
            Decimal("0"),
        )
        if segment_liters <= 0:
            continue

        total_distance += distance
        total_liters += segment_liters
        segments += 1

    if segments == 0 or total_liters <= 0 or total_distance <= 0:
        return None

    km_per_liter = float(Decimal(total_distance) / total_liters)
    return ConsumptionStats(km_per_liter=round(km_per_liter, 1), segments_used=segments)

