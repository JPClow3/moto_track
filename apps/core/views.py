from decimal import Decimal

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from apps.core.active_motorcycle import get_active_motorcycle, set_active_motorcycle
from apps.core.exports import safe_next_url
from apps.core.forms import OdometerOverrideForm, OnboardingForm
from apps.core.services.dashboard import (
    get_active_reminders,
    get_catalog_links,
    get_dashboard_cards,
    get_monthly_sparkline,
    get_quick_actions,
    get_status_cards,
    get_tire_cards,
)
from apps.core.undo import consume_undo_token
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.tires.models import TirePosition, TireRecord


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
        "recent_fuels": list(FuelRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")[:3]),
        "recent_maintenance": list(
            MaintenanceRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")[:3]
        ),
        "active_reminders": active_reminders,
        "month_total": monthly["month_total"],
        "weekly_sparkline_points": monthly["weekly_sparkline_points"],
        "pending_alerts": pending_alerts,
        "cards": get_dashboard_cards(motorcycle, current_odometer_km, monthly["month_total"], pending_alerts),
    }
    return render(request, "core/dashboard.html", context)


@login_required
def odometer_quick_update_view(request):
    motorcycle = get_active_motorcycle(request)
    is_htmx = request.headers.get("HX-Request") == "true"

    if not motorcycle:
        messages.error(request, "Cadastre uma moto antes de atualizar o odômetro.")
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
            messages.success(request, "Odômetro atualizado com sucesso.")
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
        "title": "Atualizar odômetro",
        "submit_label": "Salvar odômetro",
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
        messages.error(request, "Registro não encontrado para desfazer.")
        return redirect(request.POST.get("next") or "dashboard")

    owner = getattr(getattr(obj, "motorcycle", None), "owner", None)
    if owner != request.user:
        messages.error(request, "Você não pode desfazer este registro.")
        return redirect("dashboard")

    label = str(obj)
    obj.delete()
    messages.success(request, f"Ação desfeita: {label}.")
    return redirect(request.POST.get("next") or "dashboard")


@login_required
def onboarding_view(request):
    if get_active_motorcycle(request):
        return redirect("dashboard")

    if request.method == "POST":
        form = OnboardingForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            motorcycle = Motorcycle.objects.create(
                owner=request.user,
                name=data["motorcycle_name"],
                brand=data["brand"],
                model=data["model"],
                year=data["year"],
                odometer_override_km=data["current_odometer_km"],
                odometer_override_at=timezone.now(),
                current_odometer_km=data["current_odometer_km"],
                current_odometer_updated_at=timezone.now(),
                riding_profile=data.get("riding_profile") or "auto",
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
            set_active_motorcycle(request, motorcycle.id)
            messages.success(request, "Onboarding concluído. Sua moto já está pronta para acompanhar.")
            return redirect("dashboard")
    else:
        form = OnboardingForm()

    return render(request, "core/onboarding.html", {"form": form})
