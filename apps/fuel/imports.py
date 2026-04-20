from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from io import TextIOWrapper

from django.utils.dateparse import parse_date

from apps.fuel.models import FuelRecord, FuelType
from apps.garage.models import Motorcycle


@dataclass
class FuelImportRow:
    index: int
    data: dict
    errors: list[str]
    duplicate: bool = False

    @property
    def is_valid(self) -> bool:
        return not self.errors and not self.duplicate


def _decimal(value: str, field: str, errors: list[str]) -> Decimal:
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        errors.append(f"{field} inválido.")
        return Decimal("0")


def preview_fuel_csv(*, file_obj, motorcycle: Motorcycle) -> list[FuelImportRow]:
    wrapper = TextIOWrapper(file_obj, encoding="utf-8-sig")
    reader = csv.DictReader(wrapper)
    rows: list[FuelImportRow] = []
    for index, raw in enumerate(reader, start=1):
        errors: list[str] = []
        parsed_date = parse_date((raw.get("date") or "").strip())
        if parsed_date is None:
            errors.append("Data inválida.")
        try:
            odometer_km = int((raw.get("odometer_km") or "").strip())
        except ValueError:
            errors.append("Odômetro inválido.")
            odometer_km = 0
        liters = _decimal(raw.get("liters") or "", "Litros", errors)
        total_price = _decimal(raw.get("total_price") or "", "Valor total", errors)
        price_per_liter = _decimal(raw.get("price_per_liter") or "", "Preço por litro", errors)
        fuel_type = (raw.get("fuel_type") or FuelType.GASOLINE).strip()
        if fuel_type not in FuelType.values:
            errors.append("Tipo de combustível inválido.")
        station_name = (raw.get("station_name") or "").strip()
        tank_full = (raw.get("tank_full") or "").strip().lower() in {"1", "true", "sim", "yes"}
        duplicate = False
        if parsed_date and odometer_km:
            duplicate = FuelRecord.objects.filter(
                motorcycle=motorcycle, date=parsed_date, odometer_km=odometer_km
            ).exists()

        rows.append(
            FuelImportRow(
                index=index,
                data={
                    "date": parsed_date.isoformat() if parsed_date else "",
                    "odometer_km": odometer_km,
                    "liters": str(liters),
                    "total_price": str(total_price),
                    "price_per_liter": str(price_per_liter),
                    "fuel_type": fuel_type,
                    "tank_full": tank_full,
                    "station_name": station_name,
                },
                errors=errors,
                duplicate=duplicate,
            )
        )
    return rows


def create_fuel_records_from_rows(*, motorcycle: Motorcycle, rows: list[dict]) -> int:
    created = 0
    for row in rows:
        if FuelRecord.objects.filter(motorcycle=motorcycle, date=row["date"], odometer_km=row["odometer_km"]).exists():
            continue
        FuelRecord.objects.create(
            motorcycle=motorcycle,
            date=row["date"],
            odometer_km=row["odometer_km"],
            liters=Decimal(row["liters"]),
            total_price=Decimal(row["total_price"]),
            price_per_liter=Decimal(row["price_per_liter"]),
            fuel_type=row["fuel_type"],
            tank_full=row["tank_full"],
            station_name=row["station_name"],
        )
        created += 1
    return created
