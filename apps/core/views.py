import datetime

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from djmoney.money import Money

from apps.fuel.models import FuelRecord
from apps.fuel.services import compute_average_consumption_km_per_liter
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.reminders.models import Reminder
from apps.reminders.services import evaluate_reminder
from apps.tires.models import TirePosition, TireRecord

from .active_motorcycle import get_active_motorcycle, set_active_motorcycle
from .forms import OdometerOverrideForm


@login_required
def dashboard_view(request):
    if request.method == "POST" and request.POST.get("active_motorcycle_id"):
        set_active_motorcycle(request, int(request.POST["active_motorcycle_id"]))
        return redirect(request.POST.get("next") or "dashboard")

    motorcycle = get_active_motorcycle(request)

    if not motorcycle:
        context = {
            "motorcycle": None,
            "status_cards": [],
            "tire_cards": [],
            "quick_actions": [
                {
                    "label": "Adicionar minha primeira moto",
                    "hint": "Para começar a usar",
                    "icon": "plus-circle",
                    "url": reverse("garage:create"),
                    "tone": "primary",
                }
            ],
            "catalog_links": [],
            "recent_fuels": [],
            "recent_maintenance": [],
            "active_reminders": [],
            "month_total": 0,
            "pending_alerts": 0,
            "cards": [
                {
                    "title": "Odômetro atual",
                    "value": "Sem moto cadastrada",
                    "subtitle": "Cadastre sua moto para iniciar",
                }
            ],
        }
        return render(request, "core/dashboard.html", context)

    latest_fuel = FuelRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km").first()
    recent_fuels = list(FuelRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")[:3])
    fuel_history = list(FuelRecord.objects.filter(motorcycle=motorcycle).order_by("date", "odometer_km"))
    recent_maintenance = list(
        MaintenanceRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")[:3]
    )
    current_odometer_km = motorcycle.current_odometer_km
    active_reminders_raw = list(
        Reminder.objects.filter(motorcycle=motorcycle, is_active=True).order_by("reference_date", "reference_km")[:4]
    )
    today = timezone.localdate()
    active_reminders = [
        {"reminder": r, "evaluation": evaluate_reminder(r, current_odometer_km=current_odometer_km, today=today)}
        for r in active_reminders_raw
    ]
    last_oil = (
        MaintenanceRecord.objects.filter(motorcycle=motorcycle, maintenance_type=MaintenanceType.OIL_CHANGE)
        .order_by("-date", "-odometer_km")
        .first()
    )
    rear_tire = (
        TireRecord.objects.filter(motorcycle=motorcycle, position=TirePosition.REAR, is_active=True)
        .order_by("-installed_at")
        .first()
    )
    front_tire = (
        TireRecord.objects.filter(motorcycle=motorcycle, position=TirePosition.FRONT, is_active=True)
        .order_by("-installed_at")
        .first()
    )
    now = timezone.now()
    month_qs = FuelRecord.objects.filter(motorcycle=motorcycle, date__year=now.year, date__month=now.month)
    month_total = month_qs.aggregate(total=Sum("total_price"))["total"]
    if month_total is None:
        month_total = Money(0, "BRL")

    month_records = list(month_qs.values_list("date", "total_price"))
    first_day = datetime.date(now.year, now.month, 1)
    last_day = (first_day.replace(day=28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1)
    week_start = first_day - datetime.timedelta(days=first_day.weekday())

    weekly_totals = []
    cursor = week_start
    while cursor <= last_day:
        week_end = cursor + datetime.timedelta(days=6)
        total = Money(0, month_total.currency if hasattr(month_total, "currency") else "BRL")
        for entry_date, entry_total in month_records:
            if cursor <= entry_date <= week_end:
                # `values_list()` may return raw numeric for MoneyField; coerce to Money before summing.
                if hasattr(entry_total, "currency") and hasattr(entry_total, "amount"):
                    total += entry_total
                else:
                    total += Money(entry_total or 0, total.currency)
        weekly_totals.append(total)
        cursor = week_end + datetime.timedelta(days=1)

    weekly_amounts = [float(getattr(v, "amount", v) or 0) for v in weekly_totals]
    if any(weekly_amounts):
        max_val = max(weekly_amounts) or 1.0
        points = []
        count = len(weekly_amounts)
        for idx, value in enumerate(weekly_amounts):
            x = 0 if count == 1 else (idx * (100 / (count - 1)))
            y = 22 - ((value / max_val) * 18)
            points.append(f"{x:.2f},{y:.2f}")
        weekly_sparkline_points = " ".join(points)
    else:
        weekly_sparkline_points = ""
    pending_alerts = len([e for e in active_reminders if e["evaluation"].status in {"overdue", "due_soon"}])
    average_consumption = None
    consumption_stats = compute_average_consumption_km_per_liter(fuel_history)
    if consumption_stats:
        average_consumption = consumption_stats.km_per_liter

    def _tire_status(wear_percent):
        if wear_percent >= 70:
            return "Atenção", "warning"
        if wear_percent >= 40:
            return "Monitorar", "neutral"
        return "Bom", "good"

    def _km_to_text(value):
        if value is None:
            return "Não definido"
        return f"{value:,} km".replace(",", ".")

    next_oil_km_remaining = None
    if last_oil and last_oil.computed_next_change_km:
        next_oil_km_remaining = max(last_oil.computed_next_change_km - current_odometer_km, 0)

    status_cards = [
        {
            "icon": "droplets",
            "tone": "warning",
            "badge": "Atenção",
            "title": "Próxima troca de óleo",
            "value": _km_to_text(next_oil_km_remaining),
            "meta": "Restantes",
        },
        {
            "icon": "gauge",
            "tone": "info",
            "badge": "Consumo",
            "title": "Média de consumo",
            "value": f"{average_consumption} km/L" if average_consumption is not None else "Sem dados",
            "meta": "Histórico de abastecimentos",
        },
        {
            "icon": "calendar-clock",
            "tone": "danger",
            "badge": "Lembretes",
            "title": "Alertas ativos",
            "value": str(pending_alerts),
            "meta": "Eventos para revisar",
        },
    ]

    tire_cards = []
    for tire in [front_tire, rear_tire]:
        if not tire:
            continue
        status_label, status_tone = _tire_status(tire.wear_percent)
        image_url = None
        if tire.tire_product and tire.tire_product.image:
            image_url = tire.tire_product.image.url
        tire_cards.append(
            {
                "title": f"Pneu {tire.get_position_display()}",
                "model": tire.brand_model,
                "wear_percent": tire.wear_percent,
                "estimated_change_km": tire.estimated_change_km,
                "status_label": status_label,
                "status_tone": status_tone,
                "image_url": image_url,
            }
        )

    quick_actions = [
        {
            "label": "Adicionar abastecimento",
            "hint": "Registre em segundos",
            "icon": "fuel",
            "url": reverse("fuel:list"),
            "htmx_url": reverse("fuel:quick_create"),
            "tone": "primary",
        },
        {
            "label": "Registrar manutenção",
            "hint": "Preventiva ou corretiva",
            "icon": "wrench",
            "url": reverse("maintenance:list"),
            "htmx_url": reverse("maintenance:quick_create"),
            "tone": "secondary",
        },
        {
            "label": "Atualizar odômetro",
            "hint": "Ajuste manual",
            "icon": "gauge",
            "url": reverse("dashboard"),
            "htmx_url": reverse("quick_odometer_update"),
            "tone": "secondary",
        },
        {
            "label": "Abrir manual",
            "hint": "Consulta rápida",
            "icon": "file-text",
            "url": reverse("documents:list"),
            "tone": "secondary",
        },
    ]
    catalog_links = [
        {"label": "Catálogos de combustível", "hint": "Postos e grades", "url": reverse("fuel:catalogs")},
        {"label": "Catálogos de manutenção", "hint": "Peças e insumos", "url": reverse("maintenance:catalogs")},
        {"label": "Catálogos de pneus", "hint": "Produtos e especificações", "url": reverse("tires:catalogs")},
    ]

    context = {
        "motorcycle": motorcycle,
        "status_cards": status_cards,
        "tire_cards": tire_cards,
        "quick_actions": quick_actions,
        "catalog_links": catalog_links,
        "recent_fuels": recent_fuels,
        "recent_maintenance": recent_maintenance,
        "active_reminders": active_reminders,
        "month_total": month_total or 0,
        "weekly_sparkline_points": weekly_sparkline_points,
        "pending_alerts": pending_alerts,
        "cards": [
            {
                "title": "Odômetro atual",
                "value": f"{current_odometer_km} km",
                "subtitle": motorcycle.name,
            },
            {
                "title": "Próxima troca de óleo",
                "value": (
                    f"em {max(last_oil.computed_next_change_km - current_odometer_km, 0)} km"
                    if last_oil and last_oil.computed_next_change_km
                    else "Não definida"
                ),
                "subtitle": (
                    f"Meta: {last_oil.computed_next_change_km} km"
                    if last_oil and last_oil.computed_next_change_km
                    else "Registre uma manutenção"
                ),
            },
            {
                "title": "Último abastecimento",
                "value": f"{latest_fuel.total_price}" if latest_fuel else "Sem registro",
                "subtitle": (
                    f"{latest_fuel.liters} L em {latest_fuel.date}" if latest_fuel else "Adicione um abastecimento"
                ),
            },
            {
                "title": "Pneu traseiro",
                "value": f"Desgaste: {rear_tire.wear_percent}%" if rear_tire else "Sem registro",
                "subtitle": (f"{rear_tire.brand_model}" if rear_tire else "Cadastre o pneu traseiro"),
            },
            {
                "title": "Gasto do mês (combustível)",
                "value": f"{month_total}",
                "subtitle": "Acumulado do mês",
            },
            {
                "title": "Alertas pendentes",
                "value": str(pending_alerts),
                "subtitle": "Lembretes ativos",
            },
        ],
    }
    return render(request, "core/dashboard.html", context)


def offline_view(request):
    return render(request, "offline.html")


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

    if request.method == "POST":
        form = OdometerOverrideForm(request.POST, motorcycle=motorcycle)
        if form.is_valid():
            form.save()
            messages.success(request, "Odômetro atualizado com sucesso.")
            if is_htmx:
                response = HttpResponse()
                response["HX-Redirect"] = request.GET.get("next") or request.POST.get("next") or reverse("dashboard")
                return response
            return redirect(request.POST.get("next") or "dashboard")
        status = 422 if is_htmx else 200
    else:
        current_odometer_km = motorcycle.current_odometer_km
        form = OdometerOverrideForm(
            motorcycle=motorcycle,
            initial={
                "odometer_override_km": current_odometer_km,
                "next": request.GET.get("next") or "",
            },
        )
        status = 200

    context = {
        "form": form,
        "title": "Atualizar odômetro",
        "submit_label": "Salvar odômetro",
        "next_url": request.GET.get("next") or request.POST.get("next") or reverse("dashboard"),
    }
    return render(request, "core/partials/odometer_form.html", context, status=status)
