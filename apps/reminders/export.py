from __future__ import annotations

from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpResponse

from apps.core.exports import ExportSpec, build_csv_bytes, build_xlsx_bytes, export_response, maybe_email_export

from .models import Reminder


def reminders_queryset_for_user(user: User) -> QuerySet[Reminder]:
    return Reminder.objects.filter(motorcycle__owner=user, motorcycle__is_active=True).select_related("motorcycle")  # pylint: disable=no-member


def reminders_rows(qs: QuerySet[Reminder]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for r in qs.order_by("-is_active", "title"):
        rows.append(
            {
                "motorcycle": r.motorcycle.name,
                "title": r.title,
                "trigger_type": r.get_trigger_type_display(),  # pylint: disable=no-member
                "trigger_km": r.trigger_value_km or "",
                "trigger_days": r.trigger_value_days or "",
                "ref_km": r.reference_km or "",
                "ref_date": r.reference_date or "",
                "active": "sim" if r.is_active else "não",
            }
        )
    return rows


SPEC = ExportSpec(
    filename_base="lembretes",
    columns=[
        ("motorcycle", "Moto"),
        ("title", "Título"),
        ("trigger_type", "Gatilho"),
        ("trigger_km", "Intervalo (km)"),
        ("trigger_days", "Intervalo (dias)"),
        ("ref_km", "Referência (km)"),
        ("ref_date", "Referência (data)"),
        ("active", "Ativo"),
    ],
)


def build_export(*, user: User, start: date | None, end: date | None, fmt: str, email_to: str | None) -> HttpResponse:
    qs = reminders_queryset_for_user(user)
    # For reminders, period filter is based on created_at.
    if start:
        qs = qs.filter(created_at__date__gte=start)
    if end:
        qs = qs.filter(created_at__date__lte=end)
    rows = reminders_rows(qs)

    filename = f"{SPEC.filename_base}.{fmt}"
    if fmt == "csv":
        content = build_csv_bytes(rows=rows, columns=SPEC.columns)
        ct = "text/csv; charset=utf-8"
    else:
        content = build_xlsx_bytes(rows=rows, columns=SPEC.columns)
        ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    maybe_email_export(
        to_email=email_to,
        subject="Exportação - Lembretes",
        body="Segue em anexo a exportação solicitada.",
        attachment_name=filename,
        attachment_bytes=content,
        attachment_content_type=ct,
    )
    return export_response(content=content, filename=filename, content_type=ct)

