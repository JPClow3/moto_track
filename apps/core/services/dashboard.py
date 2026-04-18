from __future__ import annotations

import datetime

from django.db.models import Sum
from django.urls import reverse
from django.utils import timezone
from djmoney.money import Money

from apps.fuel.models import FuelRecord
from apps.fuel.services import compute_average_consumption_km_per_liter
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.reminders.models import Reminder
from apps.reminders.services import evaluate_reminder
from apps.tires.models import TirePosition, TireRecord


def _money_zero(currency="BRL") -> Money:
    return Money(0, currency)


def _km_to_text(value):
    if value is None:
        return "Não definido"
    return f"{value:,} km".replace(",", ".")


def _tire_status(wear_percent):
    if wear_percent >= 70:
        return "Atenção", "warning"
    if wear_percent >= 40:
        return "Monitorar", "neutral"
    return "Bom", "good"


def get_weekly_sparkline_points(motorcycle: Motorcycle, *, today=None) -> tuple[Money, str]:
    now = today or timezone.localdate()
    month_qs = FuelRecord.objects.filter(motorcycle=motorcycle, date__year=now.year, date__month=now.month)
    month_total = month_qs.aggregate(total=Sum("total_price"))["total"] or _money_zero()
    if getattr(month_total, "currency", None) is None:
        month_total = Money(getattr(month_total, "amount", month_total) or 0, "BRL")
    currency = getattr(month_total, "currency", "BRL")

    first_day = datetime.date(now.year, now.month, 1)
    last_day = (first_day.replace(day=28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1)
    week_start = first_day - datetime.timedelta(days=first_day.weekday())

    totals_by_week = {}
    for entry_date, entry_total in month_qs.values_list("date", "total_price"):
        bucket_start = entry_date - datetime.timedelta(days=entry_date.weekday())
        current = totals_by_week.get(bucket_start, _money_zero(currency))
        if hasattr(entry_total, "currency") and hasattr(entry_total, "amount"):
            current += entry_total
        else:
            current += Money(entry_total or 0, currency)
        totals_by_week[bucket_start] = current

    weekly_totals = []
    cursor = week_start
    while cursor <= last_day:
        weekly_totals.append(totals_by_week.get(cursor, _money_zero(currency)))
        cursor += datetime.timedelta(days=7)

    amounts = [float(getattr(v, "amount", v) or 0) for v in weekly_totals]
    if not any(amounts):
        return month_total, ""

    max_val = max(amounts) or 1.0
    count = len(amounts)
    points = []
    for idx, value in enumerate(amounts):
        x = 0 if count == 1 else (idx * (100 / (count - 1)))
        y = 22 - ((value / max_val) * 18)
        points.append(f"{x:.2f},{y:.2f}")
    return month_total, " ".join(points)


def get_monthly_sparkline(motorcycle: Motorcycle, currency="BRL") -> dict:
    month_total, weekly_sparkline_points = get_weekly_sparkline_points(motorcycle)
    if getattr(month_total, "currency", None) is None:
        month_total = Money(getattr(month_total, "amount", month_total) or 0, currency)
    return {"month_total": month_total, "weekly_sparkline_points": weekly_sparkline_points}


def get_active_reminders(motorcycle: Motorcycle, current_odometer: int, *, limit=4) -> list[dict]:
    today = timezone.localdate()
    reminders = Reminder.objects.filter(motorcycle=motorcycle, is_active=True).order_by("reference_date", "reference_km")[
        :limit
    ]
    return [
        {"reminder": reminder, "evaluation": evaluate_reminder(reminder, current_odometer_km=current_odometer, today=today)}
        for reminder in reminders
    ]


def get_status_cards(motorcycle: Motorcycle, current_odometer: int, active_reminders=None) -> tuple[list[dict], int]:
    active_reminders = active_reminders if active_reminders is not None else get_active_reminders(motorcycle, current_odometer)
    last_oil = (
        MaintenanceRecord.objects.filter(motorcycle=motorcycle, maintenance_type=MaintenanceType.OIL_CHANGE)
        .order_by("-date", "-odometer_km")
        .first()
    )
    next_oil_km_remaining = None
    if last_oil and last_oil.computed_next_change_km:
        next_oil_km_remaining = max(last_oil.computed_next_change_km - current_odometer, 0)

    history = FuelRecord.objects.filter(motorcycle=motorcycle).order_by("date", "odometer_km")
    consumption_stats = compute_average_consumption_km_per_liter(history)
    average_consumption = consumption_stats.km_per_liter if consumption_stats else None
    pending_alerts = len([e for e in active_reminders if e["evaluation"].status in {"overdue", "due_soon"}])

    return [
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
    ], pending_alerts


def get_tire_cards(motorcycle: Motorcycle) -> list[dict]:
    tires = (
        TireRecord.objects.filter(motorcycle=motorcycle, position__in=[TirePosition.FRONT, TirePosition.REAR], is_active=True)
        .select_related("tire_product")
        .order_by("position", "-installed_at")
    )
    by_position = {}
    for tire in tires:
        by_position.setdefault(tire.position, tire)

    cards = []
    for position in [TirePosition.FRONT, TirePosition.REAR]:
        tire = by_position.get(position)
        if not tire:
            continue
        status_label, status_tone = _tire_status(tire.wear_percent)
        position_label = "Dianteiro" if tire.position == TirePosition.FRONT else "Traseiro"
        image_url = tire.tire_product.image.url if tire.tire_product and tire.tire_product.image else None
        cards.append(
            {
                "title": f"Pneu {position_label}",
                "model": tire.brand_model,
                "wear_percent": tire.wear_percent,
                "estimated_change_km": tire.estimated_change_km,
                "status_label": status_label,
                "status_tone": status_tone,
                "image_url": image_url,
            }
        )
    return cards


def get_dashboard_cards(motorcycle: Motorcycle, current_odometer: int, month_total, pending_alerts: int) -> list[dict]:
    latest_fuel = FuelRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km").first()
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
    return [
        {"title": "Odômetro atual", "value": f"{current_odometer} km", "subtitle": motorcycle.name},
        {
            "title": "Próxima troca de óleo",
            "value": (
                f"em {max(last_oil.computed_next_change_km - current_odometer, 0)} km"
                if last_oil and last_oil.computed_next_change_km
                else "Não definida"
            ),
            "subtitle": (
                f"Meta: {last_oil.computed_next_change_km}"
                if last_oil and last_oil.computed_next_change_km
                else "Registre uma manutenção"
            ),
        },
        {
            "title": "Último abastecimento",
            "value": f"R$ {latest_fuel.total_price}" if latest_fuel else "Sem registro",
            "subtitle": f"{latest_fuel.liters} L em {latest_fuel.date}" if latest_fuel else "Adicione um abastecimento",
        },
        {
            "title": "Pneu traseiro",
            "value": f"Desgaste: {rear_tire.wear_percent}%" if rear_tire else "Sem registro",
            "subtitle": f"{rear_tire.brand_model}" if rear_tire else "Cadastre o pneu traseiro",
        },
        {"title": "Gasto do mês (combustível)", "value": f"R$ {month_total or 0}", "subtitle": "Acumulado do mês"},
        {"title": "Alertas pendentes", "value": str(pending_alerts), "subtitle": "Lembretes ativos"},
    ]


def get_quick_actions() -> list[dict]:
    return [
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
        {"label": "Abrir manual", "hint": "Consulta rápida", "icon": "file-text", "url": reverse("documents:list"), "tone": "secondary"},
    ]


def get_catalog_links() -> list[dict]:
    return [
        {"label": "Catálogos de combustível", "hint": "Postos e combustíveis", "url": reverse("fuel:catalogs")},
        {"label": "Catálogos de manutenção", "hint": "Peças e insumos", "url": reverse("maintenance:catalogs")},
        {"label": "Catálogos de pneus", "hint": "Produtos e especificações", "url": reverse("tires:catalogs")},
    ]
