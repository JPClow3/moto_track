from __future__ import annotations

from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.http import HttpResponse

from apps.core.exports import ExportSpec, build_csv_bytes, build_xlsx_bytes, export_response, maybe_email_export

from .models import MotorcycleDocument


def documents_queryset_for_user(user: User) -> QuerySet[MotorcycleDocument]:
    return MotorcycleDocument.objects.filter(motorcycle__owner=user, motorcycle__is_active=True).select_related("motorcycle")  # pylint: disable=no-member


def documents_rows(qs: QuerySet[MotorcycleDocument]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for d in qs.order_by("-created_at", "name"):
        rows.append(
            {
                "motorcycle": d.motorcycle.name,
                "name": d.name,
                "type": d.get_document_type_display(),  # pylint: disable=no-member
                "created_at": d.created_at.date() if d.created_at else "",
                "valid_until": d.valid_until or "",
                "notes": d.notes or "",
            }
        )
    return rows


SPEC = ExportSpec(
    filename_base="documentos",
    columns=[
        ("motorcycle", "Moto"),
        ("name", "Documento"),
        ("type", "Tipo"),
        ("created_at", "Criado em"),
        ("valid_until", "Validade"),
        ("notes", "Notas"),
    ],
)


def build_export(*, user: User, start: date | None, end: date | None, fmt: str, email_to: str | None) -> HttpResponse:
    qs = documents_queryset_for_user(user)
    if start:
        qs = qs.filter(created_at__date__gte=start)
    if end:
        qs = qs.filter(created_at__date__lte=end)
    rows = documents_rows(qs)

    filename = f"{SPEC.filename_base}.{fmt}"
    if fmt == "csv":
        content = build_csv_bytes(rows=rows, columns=SPEC.columns)
        ct = "text/csv; charset=utf-8"
    else:
        content = build_xlsx_bytes(rows=rows, columns=SPEC.columns)
        ct = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    maybe_email_export(
        to_email=email_to,
        subject="Exportação - Documentos",
        body="Segue em anexo a exportação solicitada.",
        attachment_name=filename,
        attachment_bytes=content,
        attachment_content_type=ct,
    )
    return export_response(content=content, filename=filename, content_type=ct)

