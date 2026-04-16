from __future__ import annotations

import io
from datetime import date

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.core.exports import build_csv_bytes, export_response
from apps.reports.services import cost_summary, health_score, period_comparisons, timeline_events


DETAILED_COLUMNS = [
    ("date", "Data"),
    ("source", "Área"),
    ("severity", "Severidade"),
    ("title", "Título"),
    ("description", "Descrição"),
    ("odometer_km", "Odômetro"),
    ("amount", "Valor"),
]


def detailed_csv_response(*, user, start: date | None, end: date | None) -> HttpResponse:
    rows = []
    for event in timeline_events(user=user, start=start, end=end):
        rows.append(
            {
                "date": event.date,
                "source": event.source,
                "severity": event.severity,
                "title": event.title,
                "description": event.description,
                "odometer_km": event.odometer_km or "",
                "amount": event.amount or "",
            }
        )
    content = build_csv_bytes(rows=rows, columns=DETAILED_COLUMNS)
    return export_response(content=content, filename="moto_track_detalhado.csv", content_type="text/csv; charset=utf-8")


def sale_pdf_response(*, motorcycle) -> HttpResponse:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []
    score = health_score(motorcycle=motorcycle)
    summary = cost_summary(user=motorcycle.owner, motorcycle=motorcycle)
    comparisons = period_comparisons(user=motorcycle.owner, motorcycle=motorcycle)

    story.append(Paragraph(f"Resumo para venda - {motorcycle.name}", styles["Title"]))
    story.append(Paragraph(f"{motorcycle.brand} {motorcycle.model} - {motorcycle.year}", styles["Heading2"]))
    story.append(Paragraph(f"Odômetro atual: {motorcycle.current_odometer_km} km", styles["Normal"]))
    if motorcycle.license_plate:
        story.append(Paragraph(f"Placa: {motorcycle.license_plate}", styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Saúde da moto", styles["Heading2"]))
    story.append(
        Table(
            [
                ["Score", "Manutenção", "Pneus", "Docs/Taxas", "Dados"],
                [f"{score.total}/100", f"{score.maintenance}/35", f"{score.tires}/25", f"{score.documents}/20", f"{score.data_quality}/20"],
            ],
            hAlign="LEFT",
        )
    )
    for note in score.notes:
        story.append(Paragraph(f"- {note}", styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Custos consolidados", styles["Heading2"]))
    costs = [
        ["Combustível", f"R$ {summary.fuel:.2f}"],
        ["Manutenção", f"R$ {summary.maintenance:.2f}"],
        ["Pneus", f"R$ {summary.tires:.2f}"],
        ["Taxas", f"R$ {summary.annual_fees:.2f}"],
        ["Seguros", f"R$ {summary.insurance:.2f}"],
        ["Total", f"R$ {summary.total:.2f}"],
        ["Custo/km", f"R$ {summary.cost_per_km}" if summary.cost_per_km is not None else "Sem distância suficiente"],
    ]
    table = Table([["Categoria", "Valor"], *costs], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf2fb")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("Comparativos por período", styles["Heading2"]))
    comparison_rows = [["Período", "Gasto total", "Km", "Custo/km", "Consumo"]]
    for row in comparisons:
        comparison_rows.append(
            [
                f"{row.days} dias",
                f"R$ {row.total_cost:.2f}",
                str(row.distance_km),
                f"R$ {row.cost_per_km}" if row.cost_per_km is not None else "-",
                f"{row.average_consumption_km_l} km/L" if row.average_consumption_km_l is not None else "-",
            ]
        )
    story.append(Table(comparison_rows, hAlign="LEFT"))
    story.append(Spacer(1, 12))

    if motorcycle.observations:
        story.append(Paragraph("Observações", styles["Heading2"]))
        story.append(Paragraph(motorcycle.observations, styles["Normal"]))

    doc.build(story)
    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="moto_resumo_venda.pdf"'
    return response
