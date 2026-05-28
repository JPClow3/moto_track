from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Avg, F
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from apps.billing.decorators import pro_required
from apps.billing.entitlements import has_pro_access
from apps.core.exports import parse_date_param
from apps.core.severity import SEVERITY_LABELS
from apps.core.ui import get_density, per_page_for_density
from apps.garage.active_motorcycle import get_active_motorcycle
from apps.garage.models import Motorcycle
from apps.reports.export import detailed_csv_response, sale_pdf_response
from apps.reports.models import SaleReportShare
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
    if not has_pro_access(request.user):
        return render(request, "reports/locked.html")

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
@pro_required("Exportacao CSV detalhada")
def detailed_export_view(request):
    return detailed_csv_response(
        user=request.user,
        start=parse_date_param(request.GET.get("start")),
        end=parse_date_param(request.GET.get("end")),
    )


@login_required
@pro_required("Dossie de venda em PDF")
def sale_pdf_export_view(request):
    motorcycle = get_active_motorcycle(request)
    if not motorcycle:
        return redirect("onboarding")
    return sale_pdf_response(motorcycle=motorcycle)


@login_required
@pro_required("Dossie publico de venda")
def sale_report_html_view(request, pk: int):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user)
    data = sale_report_data(motorcycle=motorcycle)
    shares = SaleReportShare.objects.filter(
        owner=request.user,
        motorcycle=motorcycle,
        revoked_at__isnull=True,
        expires_at__gte=timezone.now(),
    )
    return render(request, "reports/sale_report.html", {"motorcycle": motorcycle, "data": data, "shares": shares})


@login_required
@pro_required("Dossie publico de venda")
@require_POST
def sale_report_share_create_view(request, pk: int):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user)
    _share, token = SaleReportShare.create_for(motorcycle=motorcycle, owner=request.user, days=14)
    public_url = request.build_absolute_uri(reverse("reports:sale_report_public", args=[token]))
    messages.success(request, f"Link público criado por 14 dias: {public_url}")
    return redirect("reports:sale_report_html", pk=motorcycle.pk)


@login_required
@pro_required("Dossie publico de venda")
@require_POST
def sale_report_share_revoke_view(request, pk: int):
    share = get_object_or_404(SaleReportShare, pk=pk, owner=request.user)
    motorcycle_pk = share.motorcycle_id
    share.revoke()
    messages.success(request, "Link público revogado.")
    return redirect("reports:sale_report_html", pk=motorcycle_pk)


def sale_report_public_view(request, token: str):
    token_hash = SaleReportShare.hash_token(token)
    share = get_object_or_404(
        SaleReportShare.objects.select_related("motorcycle", "owner"),
        token_hash=token_hash,
    )
    if not share.is_active:
        raise Http404
    SaleReportShare.objects.filter(pk=share.pk).update(
        last_accessed_at=timezone.now(),
        access_count=F("access_count") + 1,
    )
    data = sale_report_data(motorcycle=share.motorcycle)
    return render(request, "reports/public_sale_report.html", {"share": share, "motorcycle": share.motorcycle, "data": data})


@login_required
@pro_required("Dossie de venda em PDF")
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
