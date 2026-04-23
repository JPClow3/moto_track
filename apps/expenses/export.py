from __future__ import annotations

from typing import Any

from django.http import HttpResponse

from apps.core.exports import ExportSpec, build_csv_bytes, export_response

from .models import AnnualFee, InsurancePolicy

SPEC = ExportSpec(
    filename_base="expenses",
    columns=[
        ("type", "type"),
        ("motorcycle", "motorcycle"),
        ("label", "label"),
        ("start_or_year", "start_or_year"),
        ("due_or_end", "due_or_end"),
        ("paid", "paid"),
        ("amount", "amount"),
        ("notes", "notes"),
    ],
)


def _expense_rows(*, user) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    fees = (
        AnnualFee.objects.filter(motorcycle__owner=user, motorcycle__is_active=True)
        .select_related("motorcycle")
        .order_by("-due_date")
    )
    for fee in fees:
        rows.append(
            {
                "type": "annual_fee",
                "motorcycle": fee.motorcycle.name,
                "label": fee.get_fee_type_display(),
                "start_or_year": fee.year,
                "due_or_end": fee.due_date,
                "paid": fee.paid_date or "",
                "amount": fee.amount,
                "notes": fee.notes,
            }
        )

    policies = (
        InsurancePolicy.objects.filter(motorcycle__owner=user, motorcycle__is_active=True)
        .select_related("motorcycle")
        .order_by("-coverage_end", "provider")
    )
    for policy in policies:
        rows.append(
            {
                "type": "insurance_policy",
                "motorcycle": policy.motorcycle.name,
                "label": policy.provider,
                "start_or_year": policy.coverage_start,
                "due_or_end": policy.coverage_end,
                "paid": "",
                "amount": policy.premium,
                "notes": policy.notes,
            }
        )
    return rows


def build_export(*, user) -> HttpResponse:
    content = build_csv_bytes(rows=_expense_rows(user=user), columns=SPEC.columns)
    return export_response(content=content, filename=f"{SPEC.filename_base}.csv", content_type="text/csv; charset=utf-8")
