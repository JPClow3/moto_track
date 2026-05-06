from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from apps.billing.decorators import pro_required
from apps.billing.entitlements import can_add_work_session, has_pro_access
from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.forms import configure_form_accessibility
from apps.core.pagination import paginate
from apps.core.ui import get_density, per_page_for_density
from apps.garage.models import Motorcycle

from .forms import ProfessionalCostSettingsForm, WorkSessionForm
from .models import ProfessionalCostSettings, WorkSession
from .services import professional_summary


@login_required
def work_dashboard_view(request):
    motorcycle = get_active_motorcycle(request)
    density = get_density(request)
    sessions_qs = WorkSession.objects.filter(owner=request.user).select_related("motorcycle")
    if motorcycle:
        sessions_qs = sessions_qs.filter(motorcycle=motorcycle)
    paged = paginate(request, sessions_qs, per_page=per_page_for_density(density))
    summary = professional_summary(user=request.user, motorcycle=motorcycle) if motorcycle else None
    return render(
        request,
        "work/dashboard.html",
        {
            "sessions": paged.items,
            "page_obj": paged.page,
            "summary": summary,
            "motorcycle": motorcycle,
            "has_pro": has_pro_access(request.user),
            "density": density,
        },
    )


@login_required
def work_session_create_view(request):
    if request.method == "POST":
        form = WorkSessionForm(request.POST, user=request.user)
        if form.is_valid():
            if not can_add_work_session(request.user, work_date=form.cleaned_data.get("work_date")):
                form.add_error(None, "O Plano Free permite ate 3 turnos por mes. O Plano Pro libera historico ilimitado.")
            else:
                form.save()
                messages.success(request, "Turno registrado com sucesso.")
                return redirect("work:dashboard")
    else:
        initial = {"work_date": timezone.localdate()}
        motorcycle = get_active_motorcycle(request)
        if motorcycle:
            initial["motorcycle"] = motorcycle
            initial["odometer_start_km"] = motorcycle.current_odometer_km
        form = WorkSessionForm(user=request.user, initial=initial)
    configure_form_accessibility(form)
    total_sessions = WorkSession.objects.filter(owner=request.user).count()
    return render(request, "work/session_form.html", {"form": form, "title": "Novo turno", "submit_label": "Salvar turno", "total_sessions": total_sessions})


@login_required
def work_session_update_view(request, pk: int):
    session = get_object_or_404(WorkSession, pk=pk, owner=request.user)
    if request.method == "POST":
        form = WorkSessionForm(request.POST, user=request.user, instance=session)
        if form.is_valid():
            if not can_add_work_session(request.user, work_date=form.cleaned_data.get("work_date"), instance=session):
                form.add_error(None, "O Plano Free permite ate 3 turnos por mes. O Plano Pro libera historico ilimitado.")
            else:
                form.save()
                messages.success(request, "Turno atualizado.")
                return redirect("work:dashboard")
    else:
        form = WorkSessionForm(user=request.user, instance=session)
    configure_form_accessibility(form)
    total_sessions = WorkSession.objects.filter(owner=request.user).count()
    return render(request, "work/session_form.html", {"form": form, "title": "Editar turno", "submit_label": "Salvar alteracoes", "total_sessions": total_sessions})


@login_required
@pro_required("Reserva de manutencao e custos profissionais")
def cost_settings_view(request, motorcycle_id: int):
    motorcycle = get_object_or_404(Motorcycle, pk=motorcycle_id, owner=request.user, is_active=True)
    settings_obj, _ = ProfessionalCostSettings.objects.get_or_create(motorcycle=motorcycle)
    if request.method == "POST":
        form = ProfessionalCostSettingsForm(request.POST, instance=settings_obj)
        if form.is_valid():
            form.save()
            messages.success(request, "Custos profissionais atualizados.")
            return redirect("work:dashboard")
    else:
        form = ProfessionalCostSettingsForm(instance=settings_obj)
    configure_form_accessibility(form)
    return render(
        request,
        "work/settings_form.html",
        {"form": form, "motorcycle": motorcycle, "title": f"Custos de {motorcycle.name}", "submit_label": "Salvar custos"},
    )
