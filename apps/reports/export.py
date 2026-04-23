from __future__ import annotations

import io
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.core.exports import build_csv_bytes, export_response
from apps.reports.services import sale_report_data, timeline_events

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


def _p(value) -> str:
    return escape("" if value is None else str(value))


def _money(value) -> str:
    return f"R$ {value:.2f}"


def _date(value: date | None) -> str:
    return value.strftime("%d/%m/%Y") if value else "-"


def _km(value: int | None) -> str:
    return f"{value} km" if value is not None else "-"


def _section_title(text: str, styles) -> Paragraph:
    return Paragraph(_p(text), styles["SectionTitle"])


def _body(text: str, styles) -> Paragraph:
    return Paragraph(_p(text), styles["BodyText"])


def _table(rows, *, col_widths=None, repeat_rows: int = 1) -> Table:
    body_style = ParagraphStyle("PdfTableBody", fontName="Helvetica", fontSize=8, leading=10)
    header_style = ParagraphStyle(
        "PdfTableHeader",
        parent=body_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
    )
    wrapped_rows = [
        [Paragraph(_p(cell), header_style if row_index < repeat_rows else body_style) for cell in row]
        for row_index, row in enumerate(rows)
    ]
    table = Table(wrapped_rows, hAlign="LEFT", colWidths=col_widths, repeatRows=repeat_rows)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#edf2fb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    return table


def _maybe_add_photo(story, motorcycle):
    photo = getattr(motorcycle, "photo", None)
    if not photo:
        return
    try:
        path = Path(photo.path)
    except (NotImplementedError, ValueError):
        return
    if not path.exists():
        return
    story.append(Image(str(path), width=160, height=105))
    story.append(Spacer(1, 12))


def sale_pdf_response(*, motorcycle) -> HttpResponse:
    data = sale_report_data(motorcycle=motorcycle)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=styles["Heading2"],
            textColor=colors.HexColor("#1d4ed8"),
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    story = []

    story.append(Paragraph(f"Dossiê de venda - {_p(motorcycle.name)}", styles["Title"]))
    story.append(Paragraph(f"{_p(motorcycle.brand)} {_p(motorcycle.model)} - {_p(motorcycle.year)}", styles["Heading2"]))
    _maybe_add_photo(story, motorcycle)
    story.append(_body(f"Odômetro atual: {_km(motorcycle.current_odometer_km)}", styles))
    if motorcycle.license_plate:
        story.append(_body(f"Placa: {motorcycle.license_plate}", styles))
    if motorcycle.previous_owners is not None:
        story.append(_body(f"Proprietários anteriores: {motorcycle.previous_owners}", styles))
    if motorcycle.purchase_date:
        story.append(_body(f"Data de compra registrada: {_date(motorcycle.purchase_date)}", styles))
    story.append(Spacer(1, 12))

    station = data.fuel_summary.most_used_station
    station_label = station.label if station else "Sem posto recorrente"
    average_fillup = (
        f"{data.fuel_summary.average_km_between_fillups} km"
        if data.fuel_summary.average_km_between_fillups is not None
        else "Sem distância suficiente"
    )
    story.append(_section_title("Resumo para comprador", styles))
    story.append(
        _table(
            [
                ["Indicador", "Valor"],
                ["Saúde da moto", f"{data.health.total}/100"],
                ["Gasto total registrado", _money(data.summary.total)],
                ["Custo por km", _money(data.summary.cost_per_km) if data.summary.cost_per_km is not None else "-"],
                ["Km médio por abastecimento registrado", average_fillup],
                ["Posto mais abastecido", station_label],
            ]
        )
    )
    for note in data.health.notes:
        story.append(_body(f"- {note}", styles))
    story.append(Spacer(1, 12))

    story.append(_section_title("Gastos consolidados", styles))
    story.append(
        _table(
            [
                ["Categoria", "Valor"],
                ["Combustível", _money(data.summary.fuel)],
                ["Manutenção", _money(data.summary.maintenance)],
                ["Pneus", _money(data.summary.tires)],
                ["Taxas", _money(data.summary.annual_fees)],
                ["Seguros", _money(data.summary.insurance)],
                ["Total", _money(data.summary.total)],
            ]
        )
    )
    story.append(Spacer(1, 12))

    story.append(_section_title("Combustível", styles))
    fuel_rows = [
        ["Registros", str(data.fuel_summary.fillups_count)],
        ["Litros registrados", f"{data.fuel_summary.liters_total:.3f} L"],
        ["Gasto em combustível", _money(data.fuel_summary.total_spend)],
        ["Km médio por abastecimento registrado", average_fillup],
    ]
    if station:
        fuel_rows.append(
            [
                "Posto mais abastecido",
                f"{station.label} ({station.fillups_count} registros, {station.liters:.3f} L, {_money(station.total_spend)})",
            ]
        )
    story.append(_table([["Métrica", "Valor"], *fuel_rows]))
    story.append(Spacer(1, 12))

    story.append(_section_title("Manutenção", styles))
    if data.maintenance_by_type:
        story.append(
            _table(
                [["Tipo", "Qtde.", "Total", "Última data"]]
                + [
                    [row.type_label, str(row.count), _money(row.total_cost), _date(row.latest_date)]
                    for row in data.maintenance_by_type
                ]
            )
        )
    else:
        story.append(_body("Nenhuma manutenção registrada.", styles))
    story.append(Spacer(1, 12))

    story.append(_section_title("Pneus", styles))
    active_tires = [row for row in data.tire_history if row.is_active]
    if active_tires:
        story.append(
            _table(
                [["Posição", "Modelo", "Instalação", "Km", "Desgaste"]]
                + [
                    [
                        row.position_label,
                        row.brand_model,
                        _date(row.installed_at),
                        _km(row.installed_odometer_km),
                        f"{row.wear_percent}%",
                    ]
                    for row in active_tires
                ]
            )
        )
    else:
        story.append(_body("Nenhum pneu ativo registrado.", styles))
    story.append(Spacer(1, 12))

    if data.documents:
        story.append(_section_title("Documentos", styles))
        story.append(
            _table(
                [["Documento", "Tipo", "Validade"]]
                + [[row.name, row.type_label, _date(row.valid_until)] for row in data.documents]
            )
        )
        story.append(Spacer(1, 12))

    if motorcycle.observations:
        story.append(_section_title("Observações do proprietário", styles))
        story.append(_body(motorcycle.observations, styles))

    story.append(PageBreak())
    story.append(Paragraph("Anexos do histórico", styles["Title"]))

    story.append(_section_title("Histórico de manutenção", styles))
    if data.maintenance_history:
        story.append(
            _table(
                [["Data", "Tipo", "Km", "Oficina", "Custo"]]
                + [
                    [_date(row.date), row.type_label, _km(row.odometer_km), row.workshop or "-", _money(row.cost)]
                    for row in data.maintenance_history
                ],
                col_widths=[58, 110, 65, 165, 65],
            )
        )
    else:
        story.append(_body("Nenhuma manutenção registrada.", styles))
    story.append(Spacer(1, 12))

    story.append(_section_title("Histórico de pneus", styles))
    if data.tire_history:
        story.append(
            _table(
                [["Data", "Posição", "Modelo", "Km", "Custo", "Ativo"]]
                + [
                    [
                        _date(row.installed_at),
                        row.position_label,
                        row.brand_model,
                        _km(row.installed_odometer_km),
                        _money(row.cost),
                        "Sim" if row.is_active else "Não",
                    ]
                    for row in data.tire_history
                ],
                col_widths=[58, 72, 160, 65, 65, 44],
            )
        )
    else:
        story.append(_body("Nenhum histórico de pneu registrado.", styles))
    story.append(Spacer(1, 12))

    story.append(_section_title("Calibragens recentes", styles))
    if data.pressure_history:
        story.append(
            _table(
                [["Data", "Dianteiro", "Traseiro", "Observações"]]
                + [
                    [_date(row.date), f"{row.psi_front} psi", f"{row.psi_rear} psi", row.notes or "-"]
                    for row in data.pressure_history
                ]
            )
        )
    else:
        story.append(_body("Nenhuma calibragem registrada.", styles))
    story.append(Spacer(1, 12))

    story.append(_section_title("Eventos recentes", styles))
    if data.recent_events:
        story.append(
            _table(
                [["Data", "Área", "Título", "Km", "Valor"]]
                + [
                    [
                        _date(event.date),
                        event.label,
                        event.title,
                        _km(event.odometer_km),
                        _money(event.amount) if event.amount is not None else "-",
                    ]
                    for event in data.recent_events
                ],
                col_widths=[58, 82, 190, 65, 65],
            )
        )
    else:
        story.append(_body("Nenhum evento recente registrado.", styles))

    story.append(Spacer(1, 12))
    story.append(_body("Documento gerado pelo Moto Track com base nos registros informados pelo proprietário.", styles))

    doc.build(story)
    response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="moto_dossie_venda.pdf"'
    return response
