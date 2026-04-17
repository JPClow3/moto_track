from django.contrib.auth.decorators import login_required
from django.db.models import Avg
from django.shortcuts import redirect, render

from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.exports import parse_date_param
from apps.core.pagination import paginate
from apps.core.severity import SEVERITY_LABELS
from apps.core.ui import get_density, per_page_for_density
from apps.reports.export import detailed_csv_response, sale_pdf_response
from apps.reports.services import (
    cost_summary,
    health_score,
    intelligent_alerts,
    maintenance_recommendations,
    monthly_real_costs,
    period_comparisons,
    timeline_events,
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
    events = timeline_events(
        user=request.user,
        motorcycle=motorcycle,
        start=start,
        end=end,
        source=source,
        severity=severity,
    )
    paged = paginate(request, events, per_page=per_page_for_density(density))
    return render(
        request,
        "reports/timeline.html",
        {
            "events": paged.items,
            "page_obj": paged.page,
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
