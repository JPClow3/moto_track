from __future__ import annotations

from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpResponse

from apps.core.exports import ExportSpec, build_csv_bytes, build_xlsx_bytes, export_response, maybe_email_export

from .models import TirePressureRecord, TireRecord

TIRES_SPEC = ExportSpec(
    filename_base="pneus",
    columns=[
        ("motorcycle", "Moto"),
        ("position", "Posição"),
        ("brand_model", "Modelo"),
        ("installed_at", "Instalado em"),
        ("installed_odometer_km", "Odômetro instalação"),
        ("wear_percent", "Desgaste (%)"),
        ("estimated_change_km", "Troca (km)"),
        ("active", "Ativo"),
    ],
)

PRESSURE_SPEC = ExportSpec(
    filename_base="calibragens",
    columns=[
        ("motorcycle", "Moto"),
        ("date", "Data"),
        ("psi_front", "PSI dianteiro"),
        ("psi_rear", "PSI traseiro"),
        ("notes", "Observação"),
    ],
)


def tires_queryset_for_user(user: User) -> QuerySet[TireRecord]:
    return TireRecord.objects.filter(motorcycle__owner=user, motorcycle__is_active=True).select_related("motorcycle")  # pylint: disable=no-member


def pressure_queryset_for_user(user: User) -> QuerySet[TirePressureRecord]:
    return TirePressureRecord.objects.filter(motorcycle__owner=user, motorcycle__is_active=True).select_related("motorcycle")  # pylint: disable=no-member


def tires_rows(qs: QuerySet[TireRecord]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in qs.order_by("-installed_at"):
        rows.append(
            {
                "motorcycle": r.motorcycle.name,
                "position": r.get_position_display(),  # pylint: disable=no-member
                "brand_model": r.brand_model,
                "installed_at": r.installed_at,
                "installed_odometer_km": r.installed_odometer_km,
                "wear_percent": r.wear_percent,
                "estimated_change_km": r.estimated_change_km or "",
                "active": "sim" if r.is_active else "não",
            }
        )
    return rows


def pressure_rows(qs: QuerySet[TirePressureRecord]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in qs.order_by("-date", "-created_at"):
        rows.append(
            {
                "motorcycle": r.motorcycle.name,
                "date": r.date,
                "psi_front": r.psi_front,
                "psi_rear": r.psi_rear,
                "notes": r.notes or "",
            }
        )
    return rows


def build_export(
    *,
    user: User,
    start: date | None,
    end: date | None,
    fmt: str,
    email_to: str | None,
    kind: str,
) -> HttpResponse:
    if kind == "pressure":
        qs = pressure_queryset_for_user(user)
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        rows = pressure_rows(qs)
        spec = PRESSURE_SPEC
        subject = "Exportação - Calibragens"
    else:
        qs = tires_queryset_for_user(user)
        if start:
            qs = qs.filter(installed_at__gte=start)
        if end:
            qs = qs.filter(installed_at__lte=end)
        rows = tires_rows(qs)
        spec = TIRES_SPEC
        subject = "Exportação - Pneus"

    filename = f"{spec.filename_base}.{fmt}"
    if fmt == "csv":
        content = build_csv_bytes(rows=rows, columns=spec.columns)
        ct = "text/csv; charset=utf-8"
    else:
        content = build_xlsx_bytes(rows=rows, columns=spec.columns)
        ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    maybe_email_export(
        to_email=email_to,
        subject=subject,
        body="Segue em anexo a exportação solicitada.",
        attachment_name=filename,
        attachment_bytes=content,
        attachment_content_type=ct,
    )
    return export_response(content=content, filename=filename, content_type=ct)

