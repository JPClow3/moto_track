from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpResponse
from djmoney.money import Money

from apps.core.exports import ExportSpec, build_csv_bytes, build_xlsx_bytes, export_response, maybe_email_export

from .models import MaintenanceRecord


def _amount(val: Money | Decimal | None) -> Decimal | None:
    if val is None:
        return None
    if hasattr(val, "amount"):
        return val.amount
    return val


def maintenance_queryset_for_user(user: User) -> QuerySet[MaintenanceRecord]:
    return MaintenanceRecord.objects.filter(motorcycle__owner=user, motorcycle__is_active=True).select_related("motorcycle")  # pylint: disable=no-member


def maintenance_rows(qs: QuerySet[MaintenanceRecord]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in qs.order_by("-date", "-odometer_km"):
        rows.append(
            {
                "date": r.date,
                "motorcycle": r.motorcycle.name,
                "type": r.get_maintenance_type_display(),  # pylint: disable=no-member
                "odometer_km": r.odometer_km,
                "cost": float(_amount(r.cost) or 0),
                "workshop": r.workshop or "",
                "interval_km": r.interval_km or "",
                "interval_days": r.interval_days or "",
                "description": r.description or "",
            }
        )
    return rows


SPEC = ExportSpec(
    filename_base="manutencoes",
    columns=[
        ("date", "Data"),
        ("motorcycle", "Moto"),
        ("type", "Tipo"),
        ("odometer_km", "Odômetro (km)"),
        ("cost", "Custo"),
        ("workshop", "Oficina"),
        ("interval_km", "Intervalo (km)"),
        ("interval_days", "Intervalo (dias)"),
        ("description", "Descrição"),
    ],
)


def build_export(*, user: User, start: date | None, end: date | None, fmt: str, email_to: str | None) -> HttpResponse:
    qs = maintenance_queryset_for_user(user)
    if start:
        qs = qs.filter(date__gte=start)
    if end:
        qs = qs.filter(date__lte=end)
    rows = maintenance_rows(qs)

    filename = f"{SPEC.filename_base}.{fmt}"
    if fmt == "csv":
        content = build_csv_bytes(rows=rows, columns=SPEC.columns)
        ct = "text/csv; charset=utf-8"
    else:
        content = build_xlsx_bytes(rows=rows, columns=SPEC.columns)
        ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    maybe_email_export(
        to_email=email_to,
        subject="Exportação - Manutenções",
        body="Segue em anexo a exportação solicitada.",
        attachment_name=filename,
        attachment_bytes=content,
        attachment_content_type=ct,
    )
    return export_response(content=content, filename=filename, content_type=ct)
