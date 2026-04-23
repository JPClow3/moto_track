"""Helpers for module exports (CSV/XLSX) and safe redirects.

This module centralizes export generation (bytes), download responses and optional
email sending. XLSX support is optional and depends on `openpyxl`.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date
from typing import Any

from django.conf import settings
from django.core.mail import EmailMessage
from django.http import HttpResponse
from django.utils.http import url_has_allowed_host_and_scheme

try:
    from openpyxl import Workbook as _OpenpyxlWorkbook  # pylint: disable=import-error
except ImportError:
    _OpenpyxlWorkbook = None  # type: ignore[assignment]


@dataclass(frozen=True)
class ExportSpec:
    """Export definition (filename + ordered columns)."""

    filename_base: str
    columns: list[tuple[str, str]]  # (key, label)


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def build_csv_bytes(*, rows: list[dict[str, Any]], columns: list[tuple[str, str]]) -> bytes:
    """Build a CSV file (UTF-8 with BOM) from rows/columns."""

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([label for _, label in columns])
    for row in rows:
        writer.writerow([_safe_str(row.get(key)) for key, _ in columns])
    return buf.getvalue().encode("utf-8-sig")


def build_xlsx_bytes(*, rows: list[dict[str, Any]], columns: list[tuple[str, str]]) -> bytes:
    """Build an XLSX file from rows/columns (requires `openpyxl`)."""

    if _OpenpyxlWorkbook is None:
        raise RuntimeError("Dependência 'openpyxl' não instalada. Instale para exportar XLSX.")
    wb = _OpenpyxlWorkbook()
    ws = wb.active
    ws.title = "Export"
    ws.append([label for _, label in columns])
    for row in rows:
        ws.append([row.get(key) for key, _ in columns])
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def export_response(*, content: bytes, filename: str, content_type: str) -> HttpResponse:
    """Return a download response for generated content."""

    resp = HttpResponse(content, content_type=content_type)
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


def maybe_email_export(
    *,
    to_email: str | None,
    subject: str,
    body: str,
    attachment_name: str,
    attachment_bytes: bytes,
    attachment_content_type: str,
) -> None:
    """Optionally email an export attachment (if `to_email` is provided)."""

    if not to_email:
        return
    msg = EmailMessage(subject=subject, body=body, from_email=settings.DEFAULT_FROM_EMAIL, to=[to_email])
    msg.attach(attachment_name, attachment_bytes, attachment_content_type)
    msg.send(fail_silently=False)


def parse_date_param(value: str | None) -> date | None:
    """Parse an ISO date (YYYY-MM-DD) or return None."""

    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def safe_next_url(*, request, candidate: str | None, fallback: str) -> str:
    """Validate a `next` URL to avoid open redirects."""

    if not candidate:
        return fallback
    if url_has_allowed_host_and_scheme(candidate, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
        return candidate
    return fallback
