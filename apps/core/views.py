import json
from decimal import Decimal

from dal import autocomplete
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.html import escape
from django.views.decorators.http import require_POST

from apps.core.active_motorcycle import get_active_motorcycle, set_active_motorcycle
from apps.core.exports import safe_next_url
from apps.core.forms import OdometerOverrideForm, OnboardingForm, configure_form_accessibility
from apps.core.services.dashboard import (
    get_active_reminders,
    get_catalog_links,
    get_dashboard_cards,
    get_monthly_sparkline,
    get_quick_actions,
    get_status_cards,
    get_tire_cards,
    get_chart_spending_distribution,
    get_chart_consumption_trend,
)
from apps.reports.services import health_score, timeline_events
from apps.core.undo import consume_undo_token
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle, MotorcycleTemplate
from apps.garage.services import apply_template_to_motorcycle, variant_observation_text
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.tires.models import TirePosition, TireRecord


class OnboardingTemplateAutocomplete(LoginRequiredMixin, autocomplete.Select2QuerySetView):
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return MotorcycleTemplate.objects.none()

        queryset = MotorcycleTemplate.objects.order_by("brand", "model", "year_from")
        query = (self.q or "").strip()
        if not query:
            return queryset

        filters = (
            Q(brand__icontains=query)
            | Q(model__icontains=query)
            | Q(variant__icontains=query)
            | Q(country_code__icontains=query)
        )
        if query.isdigit():
            year = int(query)
            filters |= Q(year_from__lte=year, year_to__isnull=True)
            filters |= Q(year_from__lte=year, year_to__gte=year)
        return queryset.filter(filters)

    def get_result_label(self, item):
        variant = f" {item.variant}" if item.variant else ""
        if item.year_to:
            year_label = f"{item.year_from}-{item.year_to}"
        else:
            year_label = f"{item.year_from}+"
        return f"{item.brand} {item.model}{variant} ({year_label})"

    def get_selected_result_label(self, item):
        return self.get_result_label(item)


@login_required
def onboarding_template_preview_view(request):
    template_id = request.GET.get("template") or request.GET.get("template_id")
    if not template_id:
        return HttpResponse("")

    template = MotorcycleTemplate.objects.select_related("spec").filter(pk=template_id).first()
    if not template:
        return HttpResponse("")

    spec = getattr(template, "spec", None)
    fuel = escape(spec.fuel_type_recommendation) if spec and spec.fuel_type_recommendation else "-"
    oil = escape(spec.oil_type_recommendation) if spec and spec.oil_type_recommendation else "-"
    variant = f" {escape(template.variant)}" if template.variant else ""
    year_label = f"{template.year_from}-{template.year_to}" if template.year_to else f"{template.year_from}+"
    html = f"""
<article class="space-y-3" aria-label="Preview do template selecionado">
  <header class="flex items-start justify-between gap-3">
    <div>
      <p class="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">Template selecionado</p>
      <h4 class="text-lg font-extrabold tracking-tight">{escape(template.brand)} {escape(template.model)}{variant}</h4>
      <p class="text-xs text-on-surface-variant">{year_label} &bull; {template.engine_cc} cc &bull; {escape(template.country_code)}</p>
    </div>
    <span class="severity-badge severity-success">Catálogo</span>
  </header>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div class="rounded-xl bg-surface-lowest p-3 ring-1 ring-outline-variant/20">
      <p class="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">Combustível</p>
      <p class="text-sm font-semibold text-on-surface">{fuel}</p>
    </div>
    <div class="rounded-xl bg-surface-lowest p-3 ring-1 ring-outline-variant/20">
      <p class="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">Óleo</p>
      <p class="text-sm font-semibold text-on-surface">{oil}</p>
    </div>
  </div>
</article>
"""
    return HttpResponse(html)


@login_required
def dashboard_view(request):
    if request.method == "POST" and request.POST.get("active_motorcycle_id"):
        set_active_motorcycle(request, int(request.POST["active_motorcycle_id"]))
        return redirect(
            safe_next_url(request=request, candidate=request.POST.get("next"), fallback=reverse("dashboard"))
        )

    motorcycle = get_active_motorcycle(request)
    if not motorcycle:
        return redirect("onboarding")

    current_odometer_km = motorcycle.current_odometer_km
    monthly = get_monthly_sparkline(motorcycle)
    active_reminders = get_active_reminders(motorcycle, current_odometer_km)
    status_cards, pending_alerts = get_status_cards(motorcycle, current_odometer_km, active_reminders)

    context = {
        "motorcycle": motorcycle,
        "status_cards": status_cards,
        "tire_cards": get_tire_cards(motorcycle),
        "quick_actions": get_quick_actions(),
        "catalog_links": get_catalog_links(),
        "active_reminders": active_reminders,
        "month_total": monthly["month_total"],
        "pending_alerts": pending_alerts,
        "cards": get_dashboard_cards(motorcycle, current_odometer_km, monthly["month_total"], pending_alerts),
        "chart_spending_distribution": get_chart_spending_distribution(motorcycle),
        "chart_consumption_trend": get_chart_consumption_trend(motorcycle),
        "health": health_score(motorcycle=motorcycle),
        "recent_events": timeline_events(user=request.user, motorcycle=motorcycle)[:5],
    }
    return render(request, "core/dashboard.html", context)


@login_required
def odometer_quick_update_view(request):
    motorcycle = get_active_motorcycle(request)
    is_htmx = request.headers.get("HX-Request") == "true"

    if not motorcycle:
        messages.error(request, "Cadastre uma moto antes de atualizar o odometro.")
        if is_htmx:
            response = HttpResponse()
            response["HX-Redirect"] = reverse("dashboard")
            return response
        return redirect("dashboard")

    current_odometer_km = motorcycle.current_odometer_km

    if request.method == "POST":
        form = OdometerOverrideForm(request.POST, motorcycle=motorcycle)
        if form.is_valid():
            form.save()
            messages.success(request, "Odometro atualizado com sucesso.")
            if is_htmx:
                response = HttpResponse()
                response["HX-Redirect"] = safe_next_url(
                    request=request,
                    candidate=request.GET.get("next") or request.POST.get("next"),
                    fallback=reverse("dashboard"),
                )
                return response
            return redirect(
                safe_next_url(request=request, candidate=request.POST.get("next"), fallback=reverse("dashboard"))
            )
        status = 422 if is_htmx else 200
    else:
        form = OdometerOverrideForm(
            motorcycle=motorcycle,
            initial={"odometer_override_km": current_odometer_km, "next": request.GET.get("next") or ""},
        )
        status = 200

    context = {
        "form": form,
        "title": "Atualizar odometro",
        "submit_label": "Salvar odometro",
        "next_url": safe_next_url(
            request=request,
            candidate=request.GET.get("next") or request.POST.get("next"),
            fallback=reverse("dashboard"),
        ),
    }
    return render(request, "core/partials/odometer_form.html", context, status=status)


@login_required
def quick_add_selector_view(request):
    next_url = safe_next_url(request=request, candidate=request.GET.get("next"), fallback=reverse("dashboard"))
    return render(request, "core/partials/quick_add_selector.html", {"next_url": next_url})


@login_required
def offline_view(request):
    return render(request, "offline.html")


def service_worker_view(request):
    build_id = getattr(settings, "APP_BUILD_ID", "dev")
    response = render(request, "sw.js", {"build_id": build_id}, content_type="application/javascript")
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "no-cache"
    return response


@login_required
def undo_action_view(request, token: str):
    if request.method != "POST":
        return redirect("dashboard")

    obj, error = consume_undo_token(request, token=token)
    if error:
        messages.error(request, error)
        return redirect(request.POST.get("next") or "dashboard")

    if obj is None:
        messages.error(request, "Registro nao encontrado para desfazer.")
        return redirect(request.POST.get("next") or "dashboard")

    owner = getattr(getattr(obj, "motorcycle", None), "owner", None)
    if owner != request.user:
        messages.error(request, "Voce nao pode desfazer este registro.")
        return redirect("dashboard")

    label = str(obj)
    obj.delete()
    messages.success(request, f"Acao desfeita: {label}.")
    return redirect(request.POST.get("next") or "dashboard")


@login_required
def onboarding_view(request):
    if get_active_motorcycle(request):
        return redirect("dashboard")

    if request.method == "POST":
        form = OnboardingForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            template = data.get("template")
            now = timezone.now()
            with transaction.atomic():
                motorcycle = Motorcycle.objects.create(
                    owner=request.user,
                    name=data["motorcycle_name"],
                    brand=data["brand"],
                    model=data["model"],
                    year=data["year"],
                    source_template=template,
                    observations=variant_observation_text(data.get("template_variant", "")),
                    odometer_override_km=data["current_odometer_km"],
                    odometer_override_at=now,
                    current_odometer_km=data["current_odometer_km"],
                    current_odometer_updated_at=now,
                    riding_profile=data.get("riding_profile") or "auto",
                )

                warnings = apply_template_to_motorcycle(
                    motorcycle=motorcycle,
                    owner=request.user,
                    template=template,
                    spec_payload=form.spec_payload(),
                )

                price_per_liter = Decimal("0")
                if data["fuel_liters"]:
                    price_per_liter = (data["fuel_total_price"] / data["fuel_liters"]).quantize(Decimal("0.001"))
                FuelRecord.objects.create(
                    motorcycle=motorcycle,
                    date=data["fuel_date"],
                    odometer_km=data["fuel_odometer_km"],
                    liters=data["fuel_liters"],
                    total_price=data["fuel_total_price"],
                    price_per_liter=price_per_liter,
                    tank_full=True,
                )
                MaintenanceRecord.objects.create(
                    motorcycle=motorcycle,
                    maintenance_type=MaintenanceType.REVIEW,
                    date=data["service_date"],
                    odometer_km=data["service_odometer_km"],
                    cost=data["service_cost"],
                    description="Serviço inicial registrado no onboarding.",
                )
                for position, label in [(TirePosition.FRONT, data["front_tire"]), (TirePosition.REAR, data["rear_tire"])]:
                    TireRecord.objects.create(
                        motorcycle=motorcycle,
                        position=position,
                        brand_model=label,
                        installed_at=data["tire_installed_at"],
                        installed_odometer_km=data["tire_odometer_km"],
                        cost=Decimal("0"),
                        wear_percent=0,
                        is_active=True,
                    )

            for warning in warnings:
                messages.warning(request, warning)
            set_active_motorcycle(request, motorcycle.id)
            messages.success(request, "Onboarding concluído. Sua moto já está pronta para acompanhar.")
            return redirect("dashboard")
    else:
        form = OnboardingForm()

    configure_form_accessibility(form)
    context = {
        "form": form,
        "selected_template": form.selected_template,
        "spec_fields": [form[field_name] for field_name in OnboardingForm.SPEC_FIELD_NAMES],
    }
    return render(request, "core/onboarding.html", context)



@login_required
@require_POST
def push_subscribe_view(request):
    try:
        data = json.loads(request.body)
        endpoint = data.get("endpoint")
        p256dh = data.get("keys", {}).get("p256dh")
        auth = data.get("keys", {}).get("auth")

        if not endpoint or not p256dh or not auth:
            return JsonResponse({"error": "Invalid subscription data"}, status=400)

        from apps.core.models import PushSubscription
        sub, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                "owner": request.user,
                "p256dh": p256dh,
                "auth": auth
            }
        )
        return JsonResponse({"status": "ok", "created": created})
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
