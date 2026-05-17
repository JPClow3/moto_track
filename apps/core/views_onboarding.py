from dal import autocomplete
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.template.loader import render_to_string
from django.utils.html import escape
from django.views.decorators.http import require_POST

from apps.core.forms import MinimalOnboardingForm, configure_form_accessibility
from apps.core.services.demo_bike import create_demo_motorcycle
from apps.core.services.onboarding import create_motorcycle_from_minimal_onboarding
from apps.garage.active_motorcycle import get_active_motorcycle, set_active_motorcycle
from apps.garage.models import Motorcycle, MotorcycleTemplate
from apps.garage.services import ensure_motorcycle_template_catalog


class OnboardingTemplateAutocomplete(LoginRequiredMixin, autocomplete.Select2QuerySetView):
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return MotorcycleTemplate.objects.none()

        ensure_motorcycle_template_catalog()
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
    try:
        template_id = int(template_id)
    except (ValueError, TypeError):
        return HttpResponse("")

    template = MotorcycleTemplate.objects.select_related("spec").filter(pk=template_id).first()
    if not template:
        return HttpResponse("")

    spec = getattr(template, "spec", None)
    fuel = escape(spec.fuel_type_recommendation) if spec and spec.fuel_type_recommendation else "-"
    oil = escape(spec.oil_type_recommendation) if spec and spec.oil_type_recommendation else "-"
    year_label = f"{template.year_from}-{template.year_to}" if template.year_to else f"{template.year_from}+"
    html = render_to_string(
        "core/partials/template_preview.html",
        {
            "template": template,
            "year_label": year_label,
            "fuel": fuel,
            "oil": oil,
        },
    )
    return HttpResponse(html)


@require_POST
@login_required
def demo_bike_create_view(request):
    if Motorcycle.objects.filter(owner=request.user).exists():
        return redirect("dashboard")
    try:
        motorcycle = create_demo_motorcycle(request.user)
    except (ValidationError, IntegrityError) as exc:
        messages.error(request, f"Não foi possível criar a moto de demonstração: {exc}")
        return redirect("onboarding")
    set_active_motorcycle(request, motorcycle.id)
    messages.success(request, "Moto de demonstração criada. Explore o painel com dados de exemplo.")
    return redirect("dashboard")


@login_required
def onboarding_view(request):
    if get_active_motorcycle(request):
        return redirect("dashboard")
    if Motorcycle.objects.filter(owner=request.user, is_active=False).exists():
        messages.info(request, "Você já tem uma moto arquivada. Reative uma moto existente ou crie uma nova pela garagem.")
        return redirect("garage:list")

    ensure_motorcycle_template_catalog()
    if request.method == "POST":
        form = MinimalOnboardingForm(request.POST)
        if form.is_valid():
            motorcycle, warnings = create_motorcycle_from_minimal_onboarding(
                form.cleaned_data,
                user=request.user,
            )
            for warning in warnings:
                messages.warning(request, warning)
            set_active_motorcycle(request, motorcycle.id)
            messages.success(request, "Sua moto está cadastrada. Vamos completar o painel.")
            return redirect("dashboard")
    else:
        form = MinimalOnboardingForm()

    configure_form_accessibility(form)

    context = {
        "form": form,
    }
    return render(request, "core/onboarding.html", context)
