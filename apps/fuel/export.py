from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpResponse
from djmoney.money import Money

from apps.core.exports import ExportSpec, build_csv_bytes, build_xlsx_bytes, export_response, maybe_email_export

from .models import FuelRecord


def _amount(val: Money | Decimal | None) -> Decimal | None:
    if val is None:
        return None
    if hasattr(val, "amount"):
        return getattr(val, "amount")
    return val


def fuel_queryset_for_user(user: User) -> QuerySet[FuelRecord]:
    return FuelRecord.objects.filter(motorcycle__owner=user, motorcycle__is_active=True).select_related("motorcycle")  # pylint: disable=no-member


def fuel_rows(qs: QuerySet[FuelRecord]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in qs.order_by("-date", "-odometer_km"):
        rows.append(
            {
                "date": r.date,
                "motorcycle": r.motorcycle.name,
                "odometer_km": r.odometer_km,
                "liters": float(r.liters),
                "price_per_liter": float(_amount(r.price_per_liter) or 0),
                "total_price": float(_amount(r.total_price) or 0),
                "station": r.station_name or "",
                "fuel_type": r.get_fuel_type_display(),  # pylint: disable=no-member
                "tank_full": "sim" if r.tank_full else "não",
                "notes": r.notes or "",
            }
        )
    return rows


SPEC = ExportSpec(
    filename_base="abastecimentos",
    columns=[
        ("date", "Data"),
        ("motorcycle", "Moto"),
        ("odometer_km", "Odômetro (km)"),
        ("liters", "Litros"),
        ("price_per_liter", "Preço/L"),
        ("total_price", "Total"),
        ("station", "Posto"),
        ("fuel_type", "Tipo"),
        ("tank_full", "Tanque cheio"),
        ("notes", "Notas"),
    ],
)


def build_export(
    *,
    user: User,
    start: date | None,
    end: date | None,
    fmt: str,
    email_to: str | None,
) -> HttpResponse:
    qs = fuel_queryset_for_user(user)
    if start:
        qs = qs.filter(date__gte=start)
    if end:
        qs = qs.filter(date__lte=end)
    rows = fuel_rows(qs)

    filename = f"{SPEC.filename_base}.{fmt}"
    if fmt == "csv":
        content = build_csv_bytes(rows=rows, columns=SPEC.columns)
        ct = "text/csv; charset=utf-8"
    else:
        content = build_xlsx_bytes(rows=rows, columns=SPEC.columns)
        ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    maybe_email_export(
        to_email=email_to,
        subject="Exportação - Abastecimentos",
        body="Segue em anexo a exportação solicitada.",
        attachment_name=filename,
        attachment_bytes=content,
        attachment_content_type=ct,
    )
    return export_response(content=content, filename=filename, content_type=ct)

