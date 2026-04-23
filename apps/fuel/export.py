from __future__ import annotations

import io
from datetime import date
from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpResponse
from djmoney.money import Money
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.core.exports import ExportSpec, build_csv_bytes, build_xlsx_bytes, export_response, maybe_email_export

from .models import FuelRecord
from .services import build_fuel_period_summary, filter_fuel_records_for_user


def _amount(val: Money | Decimal | None) -> Decimal | None:
    if val is None:
        return None
    if hasattr(val, "amount"):
        return val.amount
    return val


def fuel_queryset_for_user(user: User) -> QuerySet[FuelRecord]:
    return filter_fuel_records_for_user(user=user)


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
                "receipt": r.receipt_file.url if r.receipt_file else "",
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
        ("receipt", "Comprovante"),
        ("notes", "Notas"),
    ],
)

PDF_MAX_TABLE_ROWS = 500


def build_pdf_bytes(qs: QuerySet[FuelRecord]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30,
    )
    styles = getSampleStyleSheet()
    ordered_qs = qs.order_by("-date", "-odometer_km")
    total_records = ordered_qs.count()
    records = list(ordered_qs[:PDF_MAX_TABLE_ROWS])
    summary = build_fuel_period_summary(records)

    story = [
        Paragraph("Relatório de abastecimentos", styles["Title"]),
        Paragraph("Resumo filtrado dos registros de combustível.", styles["Normal"]),
        Spacer(1, 10),
    ]
    story.append(
        Table(
            [
                ["Total", "Litros", "Km", "Consumo oficial", "Consumo parcial", "Custo/km"],
                [
                    f"R$ {summary.total_spend:.2f}",
                    f"{summary.total_liters:.3f}",
                    str(summary.distance_km),
                    f"{summary.official_consumption_km_l} km/L" if summary.official_consumption_km_l else "-",
                    f"{summary.provisional_consumption_km_l} km/L" if summary.provisional_consumption_km_l else "-",
                    f"R$ {summary.cost_per_km}" if summary.cost_per_km else "-",
                ],
            ],
            hAlign="LEFT",
        )
    )
    story.append(Spacer(1, 12))

    if total_records > PDF_MAX_TABLE_ROWS:
        story.append(
            Paragraph(
                f"Mostrando os {PDF_MAX_TABLE_ROWS} registros mais recentes de {total_records} encontrados.",
                styles["Italic"],
            )
        )
        story.append(Spacer(1, 8))

    rows = [["Data", "Moto", "Km", "Litros", "Preço/L", "Total", "Posto", "Tipo", "Tanque", "Comprovante"]]
    for record in records:
        rows.append(
            [
                record.date.strftime("%d/%m/%Y"),
                record.motorcycle.name,
                str(record.odometer_km),
                f"{record.liters:.3f}",
                f"R$ {_amount(record.price_per_liter) or Decimal('0'):.3f}",
                f"R$ {_amount(record.total_price) or Decimal('0'):.2f}",
                record.station_name or (record.station.name if record.station else "-"),
                record.get_fuel_type_display(),
                "Cheio" if record.tank_full else "Parcial",
                "Sim" if record.receipt_file else "-",
            ]
        )
    table = Table(rows, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf2fb")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buffer.getvalue()


def build_export(
    *,
    user: User,
    start: date | None,
    end: date | None,
    fmt: str,
    email_to: str | None,
    motorcycle_id: str | int | None = None,
    station_id: str | int | None = None,
    fuel_type: str = "",
) -> HttpResponse:
    qs = filter_fuel_records_for_user(
        user=user,
        start=start,
        end=end,
        motorcycle_id=motorcycle_id,
        station_id=station_id,
        fuel_type=fuel_type,
    )
    rows = fuel_rows(qs)

    filename = f"{SPEC.filename_base}.{fmt}"
    if fmt == "csv":
        content = build_csv_bytes(rows=rows, columns=SPEC.columns)
        ct = "text/csv; charset=utf-8"
    elif fmt == "pdf":
        content = build_pdf_bytes(qs)
        ct = "application/pdf"
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
