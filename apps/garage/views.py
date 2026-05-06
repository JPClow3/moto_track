from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from djmoney.money import Money

from apps.billing.entitlements import can_add_active_motorcycle
from apps.core.forms import configure_form_accessibility
from apps.fuel.models import FuelRecord
from apps.reminders.models import Reminder
from apps.reminders.services import evaluate_reminder
from apps.reports.services import health_score

from .forms import MotorcycleForm, MotorcycleSpecForm
from .models import Motorcycle, MotorcycleSpec


@login_required
def garage_list_view(request):
    motorcycles = Motorcycle.objects.filter(owner=request.user, is_active=True).order_by(
        "name"
    )  # pylint: disable=no-member
    archived_motorcycles = Motorcycle.objects.filter(owner=request.user, is_active=False).order_by("name")
    return render(
        request,
        "garage/list.html",
        {"motorcycles": motorcycles, "archived_motorcycles": archived_motorcycles},
    )


@login_required
def garage_create_view(request):
    if request.method == "POST":
        form = MotorcycleForm(request.POST, request.FILES)
        if form.is_valid():
            if not can_add_active_motorcycle(request.user):
                form.add_error(None, "O Plano Free permite 1 moto ativa. O Plano Pro libera multiplas motos.")
            else:
                motorcycle = form.save(commit=False)
                motorcycle.owner = request.user
                motorcycle.save()
                messages.success(request, f"Moto {motorcycle.name} cadastrada com sucesso.")
                return redirect("garage:list")
    else:
        form = MotorcycleForm()
    configure_form_accessibility(form)

    total_motorcycles = Motorcycle.objects.filter(owner=request.user, is_active=True).count()
    context = {
        "form": form,
        "title": "Adicionar moto",
        "submit_label": "Salvar moto",
        "total_motorcycles": total_motorcycles,
    }
    return render(request, "garage/form.html", context)


@login_required
def garage_update_view(request, pk):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user, is_active=True)

    if request.method == "POST":
        form = MotorcycleForm(request.POST, request.FILES, instance=motorcycle)
        if form.is_valid():
            form.save()
            messages.success(request, f"Moto {motorcycle.name} atualizada com sucesso.")
            return redirect("garage:list")
    else:
        form = MotorcycleForm(instance=motorcycle)
    configure_form_accessibility(form)

    total_motorcycles = Motorcycle.objects.filter(owner=request.user, is_active=True).count()
    context = {
        "form": form,
        "title": f"Editar {motorcycle.name}",
        "submit_label": "Salvar alterações",
        "motorcycle": motorcycle,
        "total_motorcycles": total_motorcycles,
    }
    return render(request, "garage/form.html", context)


@login_required
def garage_spec_update_view(request, pk):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user, is_active=True)
    spec, _ = MotorcycleSpec.objects.get_or_create(motorcycle=motorcycle)

    if request.method == "POST":
        form = MotorcycleSpecForm(request.POST, instance=spec)
        if form.is_valid():
            form.save()
            messages.success(request, f"Especificações de {motorcycle.name} atualizadas com sucesso.")
            return redirect("garage:list")
    else:
        form = MotorcycleSpecForm(instance=spec)
    configure_form_accessibility(form)

    total_motorcycles = Motorcycle.objects.filter(owner=request.user, is_active=True).count()
    return render(
        request,
        "garage/spec_form.html",
        {
            "form": form,
            "motorcycle": motorcycle,
            "title": f"Especificações de {motorcycle.name}",
            "submit_label": "Salvar especificações",
            "total_motorcycles": total_motorcycles,
        },
    )


@login_required
def garage_delete_view(request, pk):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user, is_active=True)

    if request.method == "POST":
        name = motorcycle.name
        from apps.core.active_motorcycle import SESSION_KEY as ACTIVE_MC_KEY
        if request.session.get(ACTIVE_MC_KEY) == motorcycle.id:
            request.session.pop(ACTIVE_MC_KEY, None)
            request.session.modified = True
        motorcycle.deactivate()
        messages.success(request, f"Moto {name} arquivada com sucesso.")
        return redirect("garage:list")

    return render(request, "garage/confirm_delete.html", {"motorcycle": motorcycle})


@login_required
def garage_restore_view(request, pk):
    motorcycle = get_object_or_404(Motorcycle, pk=pk, owner=request.user, is_active=False)
    if request.method == "POST":
        motorcycle.reactivate()
        messages.success(request, f"Moto {motorcycle.name} reativada com sucesso.")
    return redirect("garage:list")


@login_required
def garage_overview_view(request):
    motorcycles = Motorcycle.objects.filter(owner=request.user).order_by("-is_active", "name")
    today = timezone.localdate()

    overview_items = []
    for motorcycle in motorcycles:
        health = health_score(motorcycle=motorcycle)
        next_reminder = None
        for reminder in Reminder.objects.filter(motorcycle=motorcycle, is_active=True).order_by("reference_km", "reference_date"):
            evaluation = evaluate_reminder(reminder, current_odometer_km=motorcycle.current_odometer_km, today=today)
            next_reminder = {"reminder": reminder, "evaluation": evaluation}
            break

        month_fuel_total = (
            FuelRecord.objects.filter(
                motorcycle=motorcycle, date__year=today.year, date__month=today.month
            ).aggregate(total=Sum("total_price"))["total"]
            or Money(0, "BRL")
        )

        overview_items.append(
            {
                "motorcycle": motorcycle,
                "health": health,
                "next_reminder": next_reminder,
                "month_fuel_total": month_fuel_total,
            }
        )

    return render(request, "garage/overview.html", {"overview_items": overview_items})
