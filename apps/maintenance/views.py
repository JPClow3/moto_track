from datetime import timedelta

from dal import autocomplete
from django import forms
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from djmoney.money import Money

from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.exports import parse_date_param, safe_next_url
from apps.core.forms import configure_form_accessibility
from apps.core.pagination import paginate
from apps.core.ui import get_density, per_page_for_density
from apps.core.undo import create_undo_token
from apps.garage.models import Motorcycle
from apps.reminders.models import Reminder
from apps.reminders.services import list_due_reminders

from .export import build_export
from .forms import MaintenancePartForm, MaintenancePlanItemForm, MaintenanceRecordQuickForm
from .models import MaintenancePart, MaintenancePhoto, MaintenancePlanItem, MaintenanceRecord, MaintenanceRecordPart, MaintenanceType

# pylint: disable=no-member


class MaintenancePartAutocomplete(autocomplete.Select2QuerySetView):
    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return MaintenancePart.objects.none()

        queryset = MaintenancePart.objects.filter(owner=self.request.user).order_by("name")
        if self.q:
            queryset = queryset.filter(name__icontains=self.q)
        return queryset


@login_required
def maintenance_list_view(request):
    records_qs = (
        MaintenanceRecord.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
        .select_related("motorcycle")
        .prefetch_related("photos")
        .order_by("-date", "-odometer_km")
    )

    motorcycle_id = request.GET.get("motorcycle")
    if motorcycle_id:
        records_qs = records_qs.filter(motorcycle_id=motorcycle_id)

    selected_motorcycle = None
    if motorcycle_id:
        selected_motorcycle = Motorcycle.objects.filter(
            owner=request.user, id=motorcycle_id, is_active=True
        ).first()  # pylint: disable=no-member
    else:
        selected_motorcycle = get_active_motorcycle(request)

    current_odometer_km = selected_motorcycle.current_odometer_km if selected_motorcycle else None
    today = timezone.localdate()

    def _card_from_latest(latest: MaintenanceRecord | None, *, title: str, icon: str):
        if not latest:
            return {
                "title": title,
                "icon": icon,
                "badge": "Sem dados",
                "tone": "neutral",
                "subtitle": "Registre uma manutenção para começar.",
                "percent": 0,
            }

        remaining_km = None
        if latest.interval_km and current_odometer_km is not None:
            due_km = latest.odometer_km + latest.interval_km
            remaining_km = due_km - current_odometer_km

        remaining_days = None
        if latest.interval_days:
            due_date = latest.date + timedelta(days=latest.interval_days)
            remaining_days = (due_date - today).days

        status = "ok"
        if (remaining_km is not None and remaining_km <= 0) or (remaining_days is not None and remaining_days <= 0):
            status = "overdue"
        elif (remaining_km is not None and remaining_km <= 200) or (remaining_days is not None and remaining_days <= 7):
            status = "soon"

        if status == "overdue":
            badge = "Ação necessária"
            tone = "danger"
        elif status == "soon":
            badge = "Monitorando"
            tone = "warning"
        else:
            badge = "Saudável"
            tone = "good"

        percent = 0
        if latest.interval_km and current_odometer_km is not None:
            used = max(current_odometer_km - latest.odometer_km, 0)
            percent = min(int(round((used / latest.interval_km) * 100)), 100)
        elif latest.interval_days:
            used_days = max((today - latest.date).days, 0)
            percent = min(int(round((used_days / latest.interval_days) * 100)), 100)

        subtitle_bits = []
        if remaining_km is not None:
            subtitle_bits.append(
                f"{remaining_km} km restantes" if remaining_km > 0 else f"{abs(remaining_km)} km vencido"
            )
        if remaining_days is not None:
            subtitle_bits.append(
                f"{remaining_days} dias restantes" if remaining_days > 0 else f"{abs(remaining_days)} dias vencido"
            )
        if not subtitle_bits:
            subtitle_bits.append("Sem intervalo definido.")

        return {
            "title": title,
            "icon": icon,
            "badge": badge,
            "tone": tone,
            "subtitle": " • ".join(subtitle_bits),
            "percent": percent,
            "latest": latest,
        }

    latest_oil = records_qs.filter(maintenance_type=MaintenanceType.OIL_CHANGE).first()
    latest_chain = records_qs.filter(maintenance_type=MaintenanceType.CHAIN_SET).first()
    latest_brakes = records_qs.filter(maintenance_type=MaintenanceType.BRAKE_PAD).first()

    status_cards = [
        _card_from_latest(latest_oil, title="Troca de óleo", icon="droplets"),
        _card_from_latest(latest_chain, title="Relação / corrente", icon="link"),
        _card_from_latest(latest_brakes, title="Pastilhas de freio", icon="disc-3"),
    ]

    upcoming_candidates: list[dict] = []

    def _status_for(remaining_km, remaining_days):
        if (remaining_km is not None and remaining_km <= 0) or (remaining_days is not None and remaining_days <= 0):
            return "overdue"
        if (remaining_km is not None and remaining_km <= 200) or (remaining_days is not None and remaining_days <= 7):
            return "due_soon"
        return "ok"

    active_plan_types = set()
    if selected_motorcycle:
        plan_qs = MaintenancePlanItem.objects.filter(motorcycle=selected_motorcycle, is_active=True)
        for item in plan_qs:
            remaining_km = None
            if item.interval_km and item.last_done_km is not None:
                remaining_km = (item.last_done_km + item.interval_km) - int(current_odometer_km or 0)

            remaining_days = None
            if item.interval_days and item.last_done_date is not None:
                due_date = item.last_done_date + timedelta(days=item.interval_days)
                remaining_days = (due_date - today).days

            if remaining_km is None and remaining_days is None:
                continue

            active_plan_types.add(item.maintenance_type)
            upcoming_candidates.append(
                {
                    "label": item.get_maintenance_type_display(),
                    "record": item,
                    "maintenance_type": item.maintenance_type,
                    "source": "plan",
                    "source_label": "Plano preventivo",
                    "is_severe_duty_override": item.is_severe_duty_override,
                    "remaining_km": remaining_km,
                    "remaining_days": remaining_days,
                    "est_cost": None,
                    "status": _status_for(remaining_km, remaining_days),
                }
            )

    # Historical intervals are fallback-only. If a preventive plan exists for a type,
    # avoid showing a second next-due calculation for the same maintenance type.
    interval_records_qs = records_qs.filter(Q(interval_km__isnull=False) | Q(interval_days__isnull=False))
    latest_interval_record_by_type: dict[str, MaintenanceRecord] = {}
    for rec in interval_records_qs:
        if rec.maintenance_type in active_plan_types or rec.maintenance_type in latest_interval_record_by_type:
            continue
        latest_interval_record_by_type[rec.maintenance_type] = rec

    for rec in latest_interval_record_by_type.values():
        due_km = rec.odometer_km + rec.interval_km if rec.interval_km else None
        due_date = rec.date + timedelta(days=rec.interval_days) if rec.interval_days else None
        remaining_km = (
            (due_km - current_odometer_km) if (due_km is not None and current_odometer_km is not None) else None
        )
        remaining_days = (due_date - today).days if due_date is not None else None

        if remaining_km is None and remaining_days is None:
            continue

        upcoming_candidates.append(
            {
                "label": rec.get_maintenance_type_display(),
                "record": rec,
                "maintenance_type": rec.maintenance_type,
                "source": "history",
                "source_label": "Baseado no histórico",
                "remaining_km": remaining_km,
                "remaining_days": remaining_days,
                "est_cost": rec.cost,
                "status": _status_for(remaining_km, remaining_days),
            }
        )

    def _sort_key(item):
        km = item["remaining_km"]
        days = item["remaining_days"]
        # overdue first (negative), then smallest positive
        km_key = km if km is not None else 10**9
        days_key = days if days is not None else 10**9
        return (min(km_key, days_key), days_key, km_key)

    upcoming_candidates.sort(key=_sort_key)
    upcoming_tasks = upcoming_candidates[:6]

    density = get_density(request)
    paged = paginate(request, records_qs, per_page=per_page_for_density(density))
    records = paged.items
    total_cost = records_qs.aggregate(total=Sum("cost"))["total"] or Money(0, "BRL")
    latest_record = records[0] if records else None
    context = {
        "records": records,
        "page_obj": paged.page,
        "total_cost": total_cost,
        "records_count": records_qs.count(),
        "latest_record": latest_record,
        "filters": {"motorcycle": motorcycle_id or ""},
        "status_cards": status_cards,
        "upcoming_tasks": upcoming_tasks,
        "selected_motorcycle": selected_motorcycle,
        "density": density,
    }
    return render(request, "maintenance/list.html", context)


@login_required
def maintenance_export_view(request):
    fmt = (request.GET.get("format") or "csv").strip().lower()
    if fmt not in {"csv", "xlsx"}:
        fmt = "csv"
    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    email_to = request.user.email if request.GET.get("email") == "1" else None
    return build_export(user=request.user, start=start, end=end, fmt=fmt, email_to=email_to)


@login_required
def maintenance_catalog_view(request):
    parts = MaintenancePart.objects.filter(owner=request.user)
    return render(request, "maintenance/catalogs.html", {"parts": parts})


@login_required
def maintenance_part_create_view(request):
    if request.method == "POST":
        form = MaintenancePartForm(request.POST)
        if form.is_valid():
            part = form.save(commit=False)
            part.owner = request.user
            part.save()
            messages.success(request, f"Peça {part.name} criada com sucesso.")
            return redirect("maintenance:catalogs")
    else:
        form = MaintenancePartForm()
    configure_form_accessibility(form)
    return render(
        request, "maintenance/part_form.html", {"form": form, "title": "Nova peça", "submit_label": "Salvar peça"}
    )


@login_required
def maintenance_part_update_view(request, pk: int):
    part = get_object_or_404(MaintenancePart, pk=pk, owner=request.user)
    if request.method == "POST":
        form = MaintenancePartForm(request.POST, instance=part)
        if form.is_valid():
            form.save()
            messages.success(request, f"Peça {part.name} atualizada com sucesso.")
            return redirect("maintenance:catalogs")
    else:
        form = MaintenancePartForm(instance=part)
    configure_form_accessibility(form)
    return render(
        request,
        "maintenance/part_form.html",
        {"form": form, "title": f"Editar {part.name}", "submit_label": "Salvar alterações", "part": part},
    )


@login_required
def maintenance_part_delete_view(request, pk: int):
    part = get_object_or_404(MaintenancePart, pk=pk, owner=request.user)
    if request.method == "POST":
        name = part.name
        part.delete()
        messages.success(request, f"Peça {name} removida com sucesso.")
        return redirect("maintenance:catalogs")
    return render(request, "maintenance/part_confirm_delete.html", {"part": part})


@login_required
def maintenance_plan_create_view(request):
    if request.method == "POST":
        form = MaintenancePlanItemForm(request.POST, user=request.user)
        if form.is_valid():
            item = form.save()
            messages.success(request, f"Plano de {item.get_maintenance_type_display()} criado com sucesso.")
            return redirect("maintenance:list")
    else:
        form = MaintenancePlanItemForm(user=request.user)
    configure_form_accessibility(form)
    return render(
        request,
        "maintenance/plan_form.html",
        {"form": form, "title": "Novo plano de manutenção", "submit_label": "Salvar plano"},
    )


@login_required
def maintenance_plan_update_view(request, pk: int):
    item = get_object_or_404(MaintenancePlanItem, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method == "POST":
        form = MaintenancePlanItemForm(request.POST, instance=item, user=request.user)
        if form.is_valid():
            item = form.save()
            messages.success(request, f"Plano de {item.get_maintenance_type_display()} atualizado com sucesso.")
            return redirect("maintenance:list")
    else:
        form = MaintenancePlanItemForm(instance=item, user=request.user)
    configure_form_accessibility(form)
    return render(
        request,
        "maintenance/plan_form.html",
        {"form": form, "title": f"Editar plano {item.get_maintenance_type_display()}", "submit_label": "Salvar alterações", "item": item},
    )


@login_required
def maintenance_plan_delete_view(request, pk: int):
    item = get_object_or_404(MaintenancePlanItem, pk=pk, motorcycle__owner=request.user, motorcycle__is_active=True)
    if request.method == "POST":
        label = item.get_maintenance_type_display()
        item.delete()
        messages.success(request, f"Plano de {label} removido com sucesso.")
        return redirect("maintenance:list")
    return render(request, "maintenance/plan_confirm_delete.html", {"item": item})


@login_required
def maintenance_quick_create_view(request):
    is_htmx = request.headers.get("HX-Request") == "true"
    active_motorcycle = get_active_motorcycle(request)

    if request.method == "POST":
        form = MaintenanceRecordQuickForm(request.POST, request.FILES, user=request.user)
        if form.is_valid():
            parts = form.cleaned_data.pop("parts", [])
            record = form.save()  # parts & photos are not model fields, so this is safe
            if parts:
                for part in parts:
                    MaintenanceRecordPart.objects.get_or_create(maintenance_record=record, part=part)
            photos = request.FILES.getlist("photos") if request.FILES else []
            if photos:
                img_validator = forms.ImageField(required=False)
                for photo in photos:
                    try:
                        img_validator.clean(photo, None)
                    except forms.ValidationError:
                        continue
                    MaintenancePhoto.objects.create(maintenance_record=record, image=photo)
            create_undo_token(
                request,
                model_label="maintenance.MaintenanceRecord",
                object_id=record.pk,
                label="Desfazer manutenção",
            )
            today = timezone.localdate()
            due = list_due_reminders(
                reminders=list(Reminder.objects.filter(motorcycle=record.motorcycle, is_active=True).order_by("title")[:10]),
                current_odometer_km=int(record.motorcycle.current_odometer_km or 0),
                today=today,
            )
            if due:
                messages.info(
                    request,
                    f"{len(due)} lembrete(s) está(ão) vencido(s) ou em breve. Você pode revisar em Lembretes.",
                )
            messages.success(request, f"Manutenção registrada para {record.motorcycle.name}.")
            if is_htmx:
                response = HttpResponse()
                response["HX-Redirect"] = safe_next_url(
                    request=request,
                    candidate=request.GET.get("next") or request.POST.get("next"),
                    fallback="/",
                )
                return response
            return redirect(
                safe_next_url(
                    request=request,
                    candidate=request.POST.get("next"),
                    fallback="maintenance:list",
                )
            )
        status = 422 if is_htmx else 200
    else:
        initial = {"next": request.GET.get("next") or ""}
        if active_motorcycle:
            initial["motorcycle"] = active_motorcycle
        form = MaintenanceRecordQuickForm(user=request.user, initial=initial)
        status = 200

    context = {
        "form": form,
        "title": "Registrar manutenção",
        "submit_label": "Salvar manutenção",
        "next_url": request.GET.get("next") or request.POST.get("next") or "",
    }
    configure_form_accessibility(form)
    return render(request, "maintenance/partials/quick_form.html", context, status=status)
