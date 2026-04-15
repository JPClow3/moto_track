from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.pagination import paginate

from .forms import ReminderForm
from .models import Reminder
from .services import evaluate_reminder


@login_required
def reminder_list_view(request):
    active_motorcycle = get_active_motorcycle(request)
    current_odometer = active_motorcycle.current_odometer_km if active_motorcycle else 0
    today = timezone.localdate()

    active_qs = (
        Reminder.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True, is_active=True)
        .select_related("motorcycle")
        .order_by("reference_date", "reference_km")
    )
    paged = paginate(request, active_qs, per_page=50)
    active_reminders = list(paged.items)
    inactive_reminders = Reminder.objects.filter(
        motorcycle__owner=request.user, motorcycle__is_active=True, is_active=False
    )

    active_with_status = [
        {"reminder": r, "evaluation": evaluate_reminder(r, current_odometer_km=current_odometer, today=today)}
        for r in active_reminders
    ]
    context = {
        "active_reminders": active_with_status,
        "page_obj": paged.page,
        "inactive_reminders": inactive_reminders,
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
