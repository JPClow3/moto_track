from datetime import date
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from djmoney.money import Money

from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.forms import configure_form_accessibility
from apps.core.exports import parse_date_param, safe_next_url
from apps.core.pagination import paginate
from apps.core.ui import get_density, per_page_for_density
from apps.core.undo import create_undo_token

from .forms import FuelGradeForm, FuelRecordQuickForm, FuelRecordRepeatForm, FuelStationForm
from .models import FuelGrade, FuelPreference, FuelRecord, FuelStation
from .services import best_fuel_preference, compute_station_rankings, detect_fuel_anomalies, remember_fuel_preference
from apps.reminders.models import Reminder
from apps.reminders.services import list_due_reminders
from .export import build_export


def _month_key(dt):
    return (dt.year, dt.month)


def _months_back(reference_date, count: int) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    year = reference_date.year
    month = reference_date.month
    for _ in range(count):
        months.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    months.reverse()
    return months


def _format_month_label(year: int, month: int) -> str:
    return timezone.datetime(year, month, 1).strftime("%b").upper()


@login_required
def fuel_list_view(request):
    records_qs = (
        FuelRecord.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
        .select_related("motorcycle")
        .order_by("-date", "-odometer_km")
    )

    motorcycle_id = request.GET.get("motorcycle")
    if motorcycle_id:
        records_qs = records_qs.filter(motorcycle_id=motorcycle_id)

    q = (request.GET.get("q") or "").strip()
    if q:
        records_qs = records_qs.filter(Q(station_name__icontains=q) | Q(notes__icontains=q))

    density = get_density(request)
    paged = paginate(request, records_qs, per_page=per_page_for_density(density))
    records = paged.items
    now = timezone.now()
    month_total = records_qs.filter(date__year=now.year, date__month=now.month).aggregate(total=Sum("total_price"))[
        "total"
    ] or Money(0, "BRL")
    total_spend = records_qs.aggregate(total=Sum("total_price"))["total"] or Money(0, "BRL")
    total_liters = records_qs.aggregate(total=Sum("liters"))["total"] or 0

    odometer_span = 0
    if len(records) > 1:
        odometer_values = [record.odometer_km for record in records]
        odometer_span = max(odometer_values) - min(odometer_values)

    avg_cost_per_km = None
    if odometer_span > 0:
        total_amount = getattr(total_spend, "amount", total_spend)
        avg_cost_per_km = round(float(total_amount) / odometer_span, 3)

    avg_liters_per_100km = None
    if odometer_span > 0 and total_liters:
        avg_liters_per_100km = round(float(total_liters) / odometer_span * 100, 2)

    last_record = records_qs.first()

    # Lightweight 6-month efficiency trend (liters/100km by month).
    months = _months_back(timezone.localdate(), 6)
    start_year, start_month = months[0]
    start_date = date(start_year, start_month, 1)
    trend_buckets = {m: {"liters": 0.0, "min_odo": None, "max_odo": None} for m in months}
    for row in records_qs.filter(date__gte=start_date).values("date", "liters", "odometer_km"):
        key = _month_key(row["date"])
        if key not in trend_buckets:
            continue
        bucket = trend_buckets[key]
        bucket["liters"] += float(row["liters"] or 0)
        odo = row["odometer_km"]
        bucket["min_odo"] = odo if bucket["min_odo"] is None else min(bucket["min_odo"], odo)
        bucket["max_odo"] = odo if bucket["max_odo"] is None else max(bucket["max_odo"], odo)

    monthly_totals = {
        _month_key(row["month"]): row["total"] or Money(0, "BRL")
        for row in (
            records_qs.filter(date__gte=start_date)
            .annotate(month=TruncMonth("date"))
            .values("month")
            .annotate(total=Sum("total_price"))
        )
        if row["month"]
    }

    trend_points = []
    values = []
    cost_points = []
    cost_values = []
    for year, month in months:
        b = trend_buckets[(year, month)]
        span = (b["max_odo"] - b["min_odo"]) if (b["min_odo"] is not None and b["max_odo"] is not None) else 0
        value = None
        if span > 0 and b["liters"] > 0:
            value = round(b["liters"] / span * 100, 2)
            values.append(value)
        trend_points.append({"label": _format_month_label(year, month), "value": value})

        # Cost per km by month (R$/km) using same odometer span heuristic.
        month_total_value = monthly_totals.get((year, month), Money(0, "BRL"))
        month_amount = float(getattr(month_total_value, "amount", month_total_value) or 0)
        cost_value = None
        if span > 0 and month_amount > 0:
            cost_value = round(month_amount / span, 3)
            cost_values.append(cost_value)
        cost_points.append({"label": _format_month_label(year, month), "value": cost_value})

    trend_max = max(values) if values else None
    cost_max = max(cost_values) if cost_values else None

    def _moving_average(series: list[float | None], window: int) -> list[float | None]:
        out: list[float | None] = []
        for idx in range(len(series)):
            start = max(0, idx - window + 1)
            chunk = [v for v in series[start : idx + 1] if v is not None]
            out.append(round(sum(chunk) / len(chunk), 3) if chunk else None)
        return out

    trend_ma = _moving_average([p["value"] for p in trend_points], 3)
    cost_ma = _moving_average([p["value"] for p in cost_points], 3)

    # "Next recommended fill-up" heuristic: average distance between last few fill-ups.
    next_recommended_km = None
    if len(records) >= 2:
        pairs = list(zip(records, records[1:], strict=False))
        deltas = [max(a.odometer_km - b.odometer_km, 0) for a, b in pairs if a.odometer_km and b.odometer_km]
        if deltas:
            avg_delta = int(round(sum(deltas) / len(deltas)))
            next_recommended_km = (records[0].odometer_km or 0) + avg_delta

    recent_fillups = records[:3]

    context = {
        "records": records,
        "page_obj": paged.page,
        "month_total": month_total,
        "total_spend": total_spend,
        "total_liters": total_liters,
        "avg_cost_per_km": avg_cost_per_km,
        "last_record": last_record,
        "avg_liters_per_100km": avg_liters_per_100km,
        "recent_fillups": recent_fillups,
        "trend_points": trend_points,
        "trend_max": trend_max,
        "cost_points": cost_points,
        "cost_max": cost_max,
        "trend_ma_last": trend_ma[-1] if trend_ma else None,
        "cost_ma_last": cost_ma[-1] if cost_ma else None,
        "next_recommended_km": next_recommended_km,
        "filters": {"q": q, "motorcycle": motorcycle_id or ""},
        "density": density,
    }
    return render(request, "fuel/list.html", context)


@login_required
def fuel_export_view(request):
    fmt = (request.GET.get("format") or "csv").strip().lower()
    if fmt not in {"csv", "xlsx"}:
        fmt = "csv"
    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    email_to = request.user.email if request.GET.get("email") == "1" else None
    return build_export(user=request.user, start=start, end=end, fmt=fmt, email_to=email_to)


@login_required
def fuel_catalog_view(request):
    stations = FuelStation.objects.filter(owner=request.user)
    grades = FuelGrade.objects.filter(owner=request.user)
    recent_records = (
        FuelRecord.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
        .select_related("station", "fuel_grade", "motorcycle")
        .order_by("-date", "-odometer_km")[:300]
    )
    ranking_rows = compute_station_rankings(recent_records)
    comparable = [r for r in ranking_rows if (r.avg_price_per_liter is not None and r.samples >= 3)]

    cheapest = min(comparable, key=lambda r: r.avg_price_per_liter) if comparable else None
    consistent_candidates = [r for r in comparable if r.std_price_per_liter is not None]
    most_consistent = min(consistent_candidates, key=lambda r: r.std_price_per_liter) if consistent_candidates else None
    weighted_candidates = [r for r in comparable if r.weighted_avg_price_per_liter is not None]
    best_weighted = min(weighted_candidates, key=lambda r: r.weighted_avg_price_per_liter) if weighted_candidates else None

    def _fmt(val):
        if val is None:
            return None
        try:
            return f"R$ {val.quantize(Decimal('0.001'))}"
        except Exception:  # noqa: BLE001
            return f"R$ {val}"

    top_by_cheapest = sorted(comparable, key=lambda r: (r.avg_price_per_liter, -r.samples))[:10]  # type: ignore[arg-type]
    top_rows = [
        {
            "label": r.station_label,
            "samples": r.samples,
            "avg": _fmt(r.avg_price_per_liter),
            "std": _fmt(r.std_price_per_liter) if r.std_price_per_liter is not None else None,
            "weighted": _fmt(r.weighted_avg_price_per_liter) if r.weighted_avg_price_per_liter is not None else None,
        }
        for r in top_by_cheapest
    ]

    return render(
        request,
        "fuel/catalogs.html",
        {
            "stations": stations,
            "grades": grades,
            "ranking_cards": {
                "cheapest": (
                    {"label": cheapest.station_label, "value": _fmt(cheapest.avg_price_per_liter), "meta": f"{cheapest.samples} amostras"}
                    if cheapest
                    else None
                ),
                "consistent": (
                    {
                        "label": most_consistent.station_label,
                        "value": _fmt(most_consistent.avg_price_per_liter),
                        "meta": f"{most_consistent.samples} amostras",
                    }
                    if most_consistent
                    else None
                ),
                "best_avg": (
                    {
                        "label": best_weighted.station_label,
                        "value": _fmt(best_weighted.weighted_avg_price_per_liter),
                        "meta": f"{best_weighted.samples} amostras",
                    }
                    if best_weighted
                    else None
                ),
            },
            "station_rankings": top_rows,
        },
    )


@login_required
def fuel_station_create_view(request):
    if request.method == "POST":
        form = FuelStationForm(request.POST)
        if form.is_valid():
            station = form.save(commit=False)
            station.owner = request.user
            station.save()
            messages.success(request, f"Posto {station.name} criado com sucesso.")
            return redirect("fuel:catalogs")
    else:
        form = FuelStationForm()

    return render(
        request, "fuel/station_form.html", {"form": form, "title": "Novo posto", "submit_label": "Salvar posto"}
    )


@login_required
def fuel_station_update_view(request, pk: int):
    station = get_object_or_404(FuelStation, pk=pk, owner=request.user)
    if request.method == "POST":
        form = FuelStationForm(request.POST, instance=station)
        if form.is_valid():
            form.save()
            messages.success(request, f"Posto {station.name} atualizado com sucesso.")
            return redirect("fuel:catalogs")
    else:
        form = FuelStationForm(instance=station)

    return render(
        request,
        "fuel/station_form.html",
        {"form": form, "title": f"Editar {station.name}", "submit_label": "Salvar alterações", "station": station},
    )


@login_required
def fuel_station_delete_view(request, pk: int):
    station = get_object_or_404(FuelStation, pk=pk, owner=request.user)
    if request.method == "POST":
        name = station.name
        station.delete()
        messages.success(request, f"Posto {name} removido com sucesso.")
        return redirect("fuel:catalogs")
    return render(request, "fuel/station_confirm_delete.html", {"station": station})


@login_required
def fuel_grade_create_view(request):
    if request.method == "POST":
        form = FuelGradeForm(request.POST)
        if form.is_valid():
            grade = form.save(commit=False)
            grade.owner = request.user
            grade.save()
            messages.success(request, f"Grade {grade.name} criada com sucesso.")
            return redirect("fuel:catalogs")
    else:
        form = FuelGradeForm()
    return render(
        request, "fuel/grade_form.html", {"form": form, "title": "Nova grade", "submit_label": "Salvar grade"}
    )


@login_required
def fuel_grade_update_view(request, pk: int):
    grade = get_object_or_404(FuelGrade, pk=pk, owner=request.user)
    if request.method == "POST":
        form = FuelGradeForm(request.POST, instance=grade)
        if form.is_valid():
            form.save()
            messages.success(request, f"Grade {grade.name} atualizada com sucesso.")
            return redirect("fuel:catalogs")
    else:
        form = FuelGradeForm(instance=grade)
    return render(
        request,
        "fuel/grade_form.html",
        {"form": form, "title": f"Editar {grade.name}", "submit_label": "Salvar alterações", "grade": grade},
    )


@login_required
def fuel_grade_delete_view(request, pk: int):
    grade = get_object_or_404(FuelGrade, pk=pk, owner=request.user)
    if request.method == "POST":
        name = grade.name
        grade.delete()
        messages.success(request, f"Grade {name} removida com sucesso.")
        return redirect("fuel:catalogs")
    return render(request, "fuel/grade_confirm_delete.html", {"grade": grade})


@login_required
def fuel_quick_create_view(request):
    is_htmx = request.headers.get("HX-Request") == "true"
    active_motorcycle = get_active_motorcycle(request)
    prefill = (request.GET.get("prefill") or "").strip().lower()

    if request.method == "POST":
        form = FuelRecordQuickForm(request.POST, user=request.user)
        if form.is_valid():
            moto = form.cleaned_data.get("motorcycle")
            if moto:
                warnings = detect_fuel_anomalies(
                    history_qs=FuelRecord.objects.filter(motorcycle=moto).select_related("motorcycle"),
                    odometer_km=int(form.cleaned_data.get("odometer_km") or 0),
                    liters=form.cleaned_data.get("liters") or 0,
                    price_per_liter=form.cleaned_data.get("price_per_liter"),
                )
                if warnings:
                    messages.warning(request, " • ".join(warnings))
            record = form.save()
            remember_fuel_preference(record)
            create_undo_token(
                request,
                model_label="fuel.FuelRecord",
                object_id=record.pk,
                label="Desfazer abastecimento",
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
            messages.success(request, f"Abastecimento registrado para {record.motorcycle.name}.")
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
                    fallback="fuel:list",
                )
            )
        status = 422 if is_htmx else 200
    else:
        initial = {"next": request.GET.get("next") or ""}
        if active_motorcycle:
            initial["motorcycle"] = active_motorcycle
            pref = best_fuel_preference(user=request.user, motorcycle=active_motorcycle)
            if pref:
                initial.update(
                    {
                        "station": pref.station,
                        "fuel_grade": pref.fuel_grade,
                        "fuel_type": pref.fuel_type,
                        "tank_full": pref.tank_full,
                        "station_name": pref.station_name,
                        "price_per_liter": pref.price_per_liter,
                    }
                )
            if prefill == "last":
                last = (
                    FuelRecord.objects.filter(motorcycle=active_motorcycle)
                    .select_related("station", "fuel_grade")
                    .order_by("-date", "-odometer_km")
                    .first()
                )
                if last:
                    initial.update(
                        {
                            "station": last.station,
                            "fuel_grade": last.fuel_grade,
                            "fuel_type": last.fuel_type,
                            "tank_full": last.tank_full,
                            "station_name": last.station_name,
                            "price_per_liter": last.price_per_liter,
                        }
                    )
        form = FuelRecordQuickForm(user=request.user, initial=initial)
        status = 200

    context = {
        "form": form,
        "title": "Adicionar abastecimento",
        "submit_label": "Salvar abastecimento",
        "next_url": request.GET.get("next") or request.POST.get("next") or "",
        "can_prefill_last": bool(active_motorcycle),
    }
    configure_form_accessibility(form)
    return render(request, "fuel/partials/quick_form.html", context, status=status)


@login_required
def fuel_repeat_last_view(request):
    is_htmx = request.headers.get("HX-Request") == "true"
    active_motorcycle = get_active_motorcycle(request)
    if not active_motorcycle:
        messages.error(request, "Selecione uma moto ativa para repetir um abastecimento.")
        if is_htmx:
            response = HttpResponse()
            response["HX-Redirect"] = safe_next_url(request=request, candidate=request.GET.get("next"), fallback="/")
            return response
        return redirect(
            safe_next_url(
                request=request,
                candidate=request.GET.get("next"),
                fallback="fuel:list",
            )
        )

    last = (
        FuelRecord.objects.filter(motorcycle=active_motorcycle)
        .select_related("station", "fuel_grade")
        .order_by("-date", "-odometer_km")
        .first()
    )
    if not last:
        messages.info(request, "Você ainda não tem abastecimentos para repetir.")
        if is_htmx:
            response = HttpResponse()
            response["HX-Redirect"] = safe_next_url(request=request, candidate=request.GET.get("next"), fallback="/")
            return response
        return redirect(
            safe_next_url(
                request=request,
                candidate=request.GET.get("next"),
                fallback="fuel:list",
            )
        )

    if request.method == "POST":
        form = FuelRecordRepeatForm(request.POST, user=request.user)
        if form.is_valid():
            moto = form.cleaned_data.get("motorcycle")
            if moto:
                warnings = detect_fuel_anomalies(
                    history_qs=FuelRecord.objects.filter(motorcycle=moto).select_related("motorcycle"),
                    odometer_km=int(form.cleaned_data.get("odometer_km") or 0),
                    liters=form.cleaned_data.get("liters") or 0,
                    price_per_liter=form.cleaned_data.get("price_per_liter"),
                )
                if warnings:
                    messages.warning(request, " • ".join(warnings))
            record = form.save()
            remember_fuel_preference(record)
            create_undo_token(
                request,
                model_label="fuel.FuelRecord",
                object_id=record.pk,
                label="Desfazer abastecimento",
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
            messages.success(request, f"Abastecimento repetido para {record.motorcycle.name}.")
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
                    fallback="fuel:list",
                )
            )
        status = 422 if is_htmx else 200
    else:
        initial = {
            "next": request.GET.get("next") or "",
            "motorcycle": active_motorcycle,
            "station": last.station,
            "fuel_grade": last.fuel_grade,
            "fuel_type": last.fuel_type,
            "tank_full": last.tank_full,
            "station_name": last.station_name,
            "notes": last.notes,
            "date": timezone.localdate(),
        }
        form = FuelRecordRepeatForm(user=request.user, initial=initial)
        status = 200

    context = {
        "form": form,
        "title": "Repetir abastecimento",
        "submit_label": "Salvar abastecimento",
        "next_url": request.GET.get("next") or request.POST.get("next") or "",
        "repeat_summary": {
            "station_name": last.station_name or (last.station.name if last.station else ""),
            "fuel_type": last.get_fuel_type_display(),
        },
    }
    configure_form_accessibility(form)
    return render(request, "fuel/partials/quick_form.html", context, status=status)


@login_required
def fuel_defaults_view(request):
    station_id = request.GET.get("station") or None
    fuel_grade_id = request.GET.get("fuel_grade") or None
    fuel_type = request.GET.get("fuel_type") or ""
    qs = FuelPreference.objects.filter(owner=request.user)
    if station_id:
        qs = qs.filter(station_id=station_id)
    if fuel_grade_id:
        qs = qs.filter(fuel_grade_id=fuel_grade_id)
    if fuel_type:
        qs = qs.filter(fuel_type=fuel_type)
    pref = qs.order_by("-use_count", "-last_used_at", "-updated_at").first()
    if not pref:
        return JsonResponse({})
    return JsonResponse(
        {
            "price_per_liter": str(pref.price_per_liter.amount) if pref.price_per_liter else "",
            "tank_full": pref.tank_full,
            "station_name": pref.station_name,
        }
    )
