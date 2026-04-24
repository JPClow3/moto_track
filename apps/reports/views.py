from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Avg
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string

from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.exports import parse_date_param
from apps.core.severity import SEVERITY_LABELS
from apps.core.ui import get_density, per_page_for_density
from apps.garage.models import Motorcycle
from apps.reports.export import detailed_csv_response, sale_pdf_response
from apps.reports.services import (
    cost_summary,
    health_score,
    intelligent_alerts,
    maintenance_recommendations,
    monthly_real_costs,
    period_comparisons,
    sale_report_data,
    timeline_events,
    timeline_events_count,
)


@login_required
def report_overview_view(request):
    motorcycle = get_active_motorcycle(request)
    if not motorcycle:
        return redirect("onboarding")

    summary = cost_summary(user=request.user, motorcycle=motorcycle)
    comparisons = period_comparisons(user=request.user, motorcycle=motorcycle)
    health = health_score(motorcycle=motorcycle)
    alerts = intelligent_alerts(user=request.user, motorcycle=motorcycle)[:6]
    monthly_costs = monthly_real_costs(user=request.user, motorcycle=motorcycle)
    recommendations = maintenance_recommendations(motorcycle=motorcycle)

    context = {
        "summary": summary,
        "documents_total": summary.annual_fees + summary.insurance,
        "comparisons": comparisons,
        "health": health,
        "alerts": alerts,
        "monthly_costs": monthly_costs,
        "recommendations": recommendations,
        "severity_labels": SEVERITY_LABELS,
        # Backwards-compatible context used by existing tests/templates.
        "fuel_total": summary.fuel,
        "maintenance_total": summary.maintenance,
        "tires_total": summary.tires,
        "annual_fees_total": summary.annual_fees,
        "insurance_premiums_total": summary.insurance,
        "total_cost": summary.total,
        "total_km": summary.distance_km,
        "cpk": summary.cost_per_km,
        "fuel_records_count": motorcycle.fuel_records.count(),
        "maintenance_records_count": motorcycle.maintenance_records.count(),
        "tires_records_count": motorcycle.tire_records.count(),
        "annual_fees_count": motorcycle.annual_fees.count(),
        "insurance_policies_count": motorcycle.insurance_policies.count(),
        "avg_odometer_km": motorcycle.fuel_records.aggregate(avg=Avg("odometer_km"))["avg"],
    }
    return render(request, "reports/overview.html", context)


@login_required
def report_timeline_view(request):
    motorcycle = get_active_motorcycle(request)
    if not motorcycle:
        return redirect("onboarding")

    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    source = (request.GET.get("source") or "").strip()
    severity = (request.GET.get("severity") or "").strip()
    density = get_density(request)
    per_page = per_page_for_density(density)
    total_events = timeline_events_count(
        user=request.user,
        motorcycle=motorcycle,
        start=start,
        end=end,
        source=source,
        severity=severity,
    )
    page_obj = Paginator(range(total_events), per_page).get_page(request.GET.get("page") or 1)
    events = timeline_events(
        user=request.user,
        motorcycle=motorcycle,
        start=start,
        end=end,
        source=source,
        severity=severity,
        limit=per_page,
        offset=(page_obj.number - 1) * per_page,
    )
    return render(
        request,
        "reports/timeline.html",
        {
            "events": events,
            "page_obj": page_obj,
            "filters": {"start": request.GET.get("start") or "", "end": request.GET.get("end") or "", "source": source, "severity": severity},
            "density": density,
        },
    )


@login_required
def detailed_export_view(request):
    return detailed_csv_response(
        user=request.user,
        start=parse_date_param(request.GET.get("start")),
        end=parse_date_param(request.GET.get("end")),
    )


@login_required
def sale_pdf_export_view(request):
    motorcycle = get_active_motorcycle(request)
    if not motorcycle:
        return redirect("onboarding")
    return sale_pdf_response(motorcycle=motorcycle)


@login_required
def sale_report_html_view(request, pk: int):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user)
    data = sale_report_data(motorcycle=motorcycle)
    return render(request, "reports/sale_report.html", {"motorcycle": motorcycle, "data": data})


@login_required
def sale_report_weasyprint_view(request, pk: int):
    try:
        from weasyprint import HTML  # type: ignore[import-untyped]
    except ImportError as exc:
        raise ImportError(
            "weasyprint is required for PDF export. Install it: pip install 'weasyprint>=61.0'"
        ) from exc

    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user)
    data = sale_report_data(motorcycle=motorcycle)
    html_string = render_to_string("reports/sale_report.html", {"motorcycle": motorcycle, "data": data, "print_mode": True})
    pdf = HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf()
    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="dossie_venda_{motorcycle.name}.pdf"'
    return response
