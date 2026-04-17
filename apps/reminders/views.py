from datetime import timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from apps.core.exports import parse_date_param
from apps.core.pagination import paginate
from apps.core.ui import get_density, per_page_for_density

from .forms import ReminderForm
from .models import Reminder, TriggerType
from .services import evaluate_reminder
from .export import build_export


@login_required
def reminder_list_view(request):
    today = timezone.localdate()

    active_qs = (
        Reminder.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True, is_active=True)
        .select_related("motorcycle")
        .order_by("reference_date", "reference_km")
    )
    density = get_density(request)
    paged = paginate(request, active_qs, per_page=per_page_for_density(density))
    active_reminders = list(paged.items)
    inactive_reminders = (
        Reminder.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True, is_active=False)
        .select_related("motorcycle")
        .order_by("-updated_at")[:50]
    )

    active_with_status = [
        {"reminder": r, "evaluation": evaluate_reminder(r, current_odometer_km=r.motorcycle.current_odometer_km, today=today)}
        for r in active_reminders
    ]
    context = {
        "active_reminders": active_with_status,
        "page_obj": paged.page,
        "inactive_reminders": inactive_reminders,
        "density": density,
    }
    return render(request, "reminders/list.html", context)


@login_required
def reminder_create_view(request):
    if request.method == "POST":
        form = ReminderForm(request.POST, user=request.user)
        if form.is_valid():
            reminder = form.save()
            messages.success(request, f"Lembrete {reminder.title} criado com sucesso.")
            return redirect("reminders:list")
    else:
        form = ReminderForm(user=request.user)

    context = {
        "form": form,
        "title": "Novo lembrete",
        "submit_label": "Salvar lembrete",
    }
    return render(request, "reminders/form.html", context)


@login_required
def reminder_update_view(request, pk):
    reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)

    if request.method == "POST":
        form = ReminderForm(request.POST, instance=reminder, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, f"Lembrete {reminder.title} atualizado com sucesso.")
            return redirect("reminders:list")
    else:
        form = ReminderForm(instance=reminder, user=request.user)

    context = {
        "form": form,
        "title": f"Editar {reminder.title}",
        "submit_label": "Salvar alterações",
        "reminder": reminder,
    }
    return render(request, "reminders/form.html", context)


@login_required
def reminder_delete_view(request, pk):
    reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)

    if request.method == "POST":
        title = reminder.title
        reminder.delete()
        messages.success(request, f"Lembrete {title} removido com sucesso.")
        return redirect("reminders:list")

    return render(request, "reminders/confirm_delete.html", {"reminder": reminder})


@login_required
def reminder_export_view(request):
    fmt = (request.GET.get("format") or "csv").strip().lower()
    if fmt not in {"csv", "xlsx"}:
        fmt = "csv"
    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    email_to = request.user.email if request.GET.get("email") == "1" else None
    return build_export(user=request.user, start=start, end=end, fmt=fmt, email_to=email_to)


@login_required
def reminder_snooze_days_view(request, pk: int, days: int):
    reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method != "POST":
        return redirect("reminders:list")

    days = max(int(days or 0), 0)
    today = timezone.localdate()

    if reminder.trigger_type in {TriggerType.BY_DATE, TriggerType.BY_INTERVAL}:
        base = reminder.reference_date or today
        reminder.reference_date = base + timedelta(days=days)
        reminder.save(update_fields=["reference_date", "updated_at"])
        messages.success(request, f"Lembrete adiado em {days} dias.")
    else:
        messages.info(request, "Este lembrete não é por data.")

    return redirect("reminders:list")


@login_required
def reminder_snooze_km_view(request, pk: int, km: int):
    reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method != "POST":
        return redirect("reminders:list")

    km = max(int(km or 0), 0)
    current_odo = int(reminder.motorcycle.current_odometer_km or 0)

    if reminder.trigger_type in {TriggerType.BY_KM, TriggerType.BY_INTERVAL}:
        base = reminder.reference_km if reminder.reference_km is not None else current_odo
        reminder.reference_km = int(base) + km
        reminder.save(update_fields=["reference_km", "updated_at"])
        messages.success(request, f"Lembrete adiado em +{km} km.")
    else:
        messages.info(request, "Este lembrete não é por km.")

    return redirect("reminders:list")
