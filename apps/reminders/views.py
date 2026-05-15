from datetime import timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from apps.billing.decorators import pro_required
from apps.billing.entitlements import can_add_active_reminder
from apps.core.exports import parse_date_param
from apps.core.forms import configure_form_accessibility
from apps.core.pagination import paginate
from apps.core.ui import get_density, per_page_for_density
from apps.maintenance.models import MaintenanceRecord, MaintenanceType

from .export import build_export
from .forms import ReminderForm
from .models import Reminder, TriggerType
from .services import evaluate_reminder


@login_required
def reminder_list_view(request):
    today = timezone.localdate()
    q = (request.GET.get("q") or "").strip()
    status = (request.GET.get("status") or "").strip().lower()
    motorcycle_id = request.GET.get("motorcycle") or ""

    active_qs = (
        Reminder.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True, is_active=True)
        .select_related("motorcycle")
        .order_by("reference_date", "reference_km")
    )
    inactive_base_qs = Reminder.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True, is_active=False)
    if motorcycle_id:
        active_qs = active_qs.filter(motorcycle_id=motorcycle_id)
        inactive_base_qs = inactive_base_qs.filter(motorcycle_id=motorcycle_id)
    if q:
        query = Q(title__icontains=q) | Q(description__icontains=q)
        active_qs = active_qs.filter(query)
        inactive_base_qs = inactive_base_qs.filter(query)
    if status == "inactive":
        active_qs = active_qs.none()
    elif status == "active":
        inactive_base_qs = inactive_base_qs.none()

    density = get_density(request)
    paged = paginate(request, active_qs, per_page=per_page_for_density(density))
    active_reminders = list(paged.items)
    inactive_paged = paginate(
        request,
        inactive_base_qs.select_related("motorcycle").order_by("-updated_at"),
        per_page=per_page_for_density(density),
        page_param="inactive_page",
    )
    inactive_reminders = list(inactive_paged.items)

    active_with_status = [
        {"reminder": r, "evaluation": evaluate_reminder(r, current_odometer_km=r.motorcycle.current_odometer_km, today=today)}
        for r in active_reminders
    ]
    context = {
        "active_reminders": active_with_status,
        "page_obj": paged.page,
        "inactive_reminders": inactive_reminders,
        "inactive_page_obj": inactive_paged.page,
        "density": density,
        "filters": {"q": q, "status": status, "motorcycle": motorcycle_id},
    }
    return render(request, "reminders/list.html", context)


@login_required
def reminder_create_view(request):
    if request.method == "POST":
        form = ReminderForm(request.POST, user=request.user)
        if form.is_valid():
            if not can_add_active_reminder(request.user, will_be_active=form.cleaned_data.get("is_active", True)):
                form.add_error(None, "O Plano Free permite ate 3 lembretes ativos. O Plano Pro libera lembretes profissionais.")
            else:
                reminder = form.save()
                messages.success(request, f"Lembrete {reminder.title} criado com sucesso.")
                return redirect("reminders:list")
    else:
        form = ReminderForm(user=request.user)
    configure_form_accessibility(form)

    total_reminders = Reminder.objects.filter(motorcycle__owner=request.user).count()
    context = {
        "form": form,
        "title": "Novo lembrete",
        "submit_label": "Salvar lembrete",
        "total_reminders": total_reminders,
    }
    return render(request, "reminders/form.html", context)


@login_required
def reminder_update_view(request, pk):
    reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)

    if request.method == "POST":
        form = ReminderForm(request.POST, instance=reminder, user=request.user)
        if form.is_valid():
            if not can_add_active_reminder(
                request.user,
                instance=reminder,
                will_be_active=form.cleaned_data.get("is_active", True),
            ):
                form.add_error(None, "O Plano Free permite ate 3 lembretes ativos. O Plano Pro libera lembretes profissionais.")
            else:
                form.save()
                messages.success(request, f"Lembrete {reminder.title} atualizado com sucesso.")
                return redirect("reminders:list")
    else:
        form = ReminderForm(instance=reminder, user=request.user)
    configure_form_accessibility(form)

    total_reminders = Reminder.objects.filter(motorcycle__owner=request.user).count()
    context = {
        "form": form,
        "title": f"Editar {reminder.title}",
        "submit_label": "Salvar alterações",
        "reminder": reminder,
        "total_reminders": total_reminders,
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
@pro_required("Exportacao de lembretes")
def reminder_export_view(request):
    fmt = (request.GET.get("format") or "csv").strip().lower()
    if fmt not in {"csv", "xlsx"}:
        fmt = "csv"
    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    email_to = request.user.email if request.GET.get("email") == "1" else None
    return build_export(user=request.user, start=start, end=end, fmt=fmt, email_to=email_to)


def _htmx_or_redirect(request, redirect_url):
    if request.headers.get("HX-Request"):
        return HttpResponse("", status=200)
    return redirect(redirect_url)


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
        reminder.last_notified_at = None
        reminder.save(update_fields=["reference_date", "last_notified_at", "updated_at"])
        messages.success(request, f"Lembrete adiado em {days} dias.")
    else:
        messages.info(request, "Este lembrete não é por data.")

    return _htmx_or_redirect(request, "reminders:list")


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
        reminder.last_notified_at = None
        reminder.save(update_fields=["reference_km", "last_notified_at", "updated_at"])
        messages.success(request, f"Lembrete adiado em +{km} km.")
    else:
        messages.info(request, "Este lembrete não é por km.")

    return _htmx_or_redirect(request, "reminders:list")


@login_required
def reminder_concluir_view(request, pk: int):
    reminder = get_object_or_404(Reminder, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method != "POST":
        return redirect("reminders:list")

    today = timezone.localdate()
    current_odo = int(reminder.motorcycle.current_odometer_km or 0)

    try:
        MaintenanceRecord.objects.create(
            motorcycle=reminder.motorcycle,
            maintenance_type=MaintenanceType.OTHER,
            date=today,
            odometer_km=current_odo,
            description=reminder.title,
            cost=0,
        )
    except ValidationError as exc:
        messages.error(request, f"Não foi possível registrar a manutenção: {exc}")
        return _htmx_or_redirect(request, "reminders:list")

    reminder.is_active = False
    reminder.save(update_fields=["is_active", "updated_at"])
    messages.success(request, f"Lembrete '{reminder.title}' concluído e registrado na manutenção.")
    return _htmx_or_redirect(request, "reminders:list")
