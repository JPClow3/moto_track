import secrets
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max, Min, Q, Sum
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from djmoney.money import Money

from apps.billing.decorators import pro_required
from apps.billing.entitlements import can_add_uploads
from apps.core.exports import parse_date_param, safe_next_url
from apps.core.forms import configure_form_accessibility
from apps.core.pagination import paginate
from apps.core.services.idempotency import (
    claim_client_submission,
    client_submission_token_for_form,
    completed_client_submission,
    record_client_submission,
)
from apps.core.ui import get_density, per_page_for_density
from apps.core.undo import create_undo_token
from apps.garage.active_motorcycle import get_active_motorcycle
from apps.reminders.models import Reminder
from apps.reminders.services import list_due_reminders

from .export import build_export
from .forms import FuelGradeForm, FuelRecordQuickForm, FuelRecordRepeatForm, FuelReviewPreferenceForm, FuelStationForm
from .imports import create_fuel_records_from_rows, preview_fuel_csv
from .models import FuelGrade, FuelPreference, FuelRecord, FuelReviewPreference, FuelStation, FuelType
from .services import (
    best_fuel_preference,
    build_fuel_period_summary,
    compute_station_rankings,
    detect_fuel_anomalies,
    detect_fuel_anomalies_from_history,
    filter_fuel_records_for_user,
    monthly_fuel_trend,
    remember_fuel_preference,
    review_suggestion_for_motorcycle,
)


@login_required
def fuel_list_view(request):
    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    motorcycle_id = request.GET.get("motorcycle") or ""
    station_id = request.GET.get("station") or ""
    fuel_type = request.GET.get("fuel_type") or ""
    records_qs = filter_fuel_records_for_user(
        user=request.user,
        start=start,
        end=end,
        motorcycle_id=motorcycle_id,
        station_id=station_id,
        fuel_type=fuel_type,
    )

    q = (request.GET.get("q") or "").strip()
    if q:
        records_qs = records_qs.filter(Q(station_name__icontains=q) | Q(notes__icontains=q))

    density = get_density(request)
    paged = paginate(request, records_qs, per_page=per_page_for_density(density))
    records = paged.items
    today = timezone.localdate()
    month_total = records_qs.filter(date__year=today.year, date__month=today.month).aggregate(total=Sum("total_price"))[
        "total"
    ] or Money(0, "BRL")
    total_spend = records_qs.aggregate(total=Sum("total_price"))["total"] or Money(0, "BRL")
    total_liters = records_qs.aggregate(total=Sum("liters"))["total"] or 0

    odometer_bounds = records_qs.aggregate(min_odometer=Min("odometer_km"), max_odometer=Max("odometer_km"))
    odometer_span = int(odometer_bounds["max_odometer"] or 0) - int(odometer_bounds["min_odometer"] or 0)

    avg_cost_per_km = None
    if odometer_span > 0:
        total_amount = getattr(total_spend, "amount", total_spend)
        avg_cost_per_km = round(float(total_amount) / odometer_span, 3)

    period_summary = build_fuel_period_summary(records_qs)
    avg_liters_per_100km = period_summary.official_liters_per_100km

    last_record = records_qs.first()

    trend = monthly_fuel_trend(records_qs)

    next_fill_up = period_summary.next_fill_up

    recent_fillups = records[:3]
    selected_motorcycle = None
    if motorcycle_id:
        from apps.garage.models import Motorcycle

        selected_motorcycle = Motorcycle.objects.filter(owner=request.user, id=motorcycle_id, is_active=True).first()
    selected_motorcycle = selected_motorcycle or get_active_motorcycle(request)
    review_form = None
    review_suggestion = None
    if selected_motorcycle:
        try:
            review_preference = selected_motorcycle.fuel_review_preference
        except FuelReviewPreference.DoesNotExist:
            review_preference = FuelReviewPreference(motorcycle=selected_motorcycle)
        review_form = FuelReviewPreferenceForm(instance=review_preference)
        configure_form_accessibility(review_form)
        review_suggestion = review_suggestion_for_motorcycle(selected_motorcycle)

    for record in records:
        record.anomaly_warnings = []
        history_qs = records_qs.filter(
            Q(date__lt=record.date)
            | Q(date=record.date, odometer_km__lt=record.odometer_km)
            | Q(date=record.date, odometer_km=record.odometer_km, pk__lt=record.pk)
        ).order_by("date", "odometer_km", "pk").only(
            "pk", "date", "odometer_km", "liters", "price_per_liter", "price_per_liter_currency",
            "tank_full", "motorcycle", "station", "fuel_grade"
        )
        warnings = detect_fuel_anomalies_from_history(
            history_records=list(history_qs),
            odometer_km=record.odometer_km,
            liters=record.liters,
            price_per_liter=record.price_per_liter,
        )
        if warnings:
            record.anomaly_warnings = warnings

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
        "trend_points": trend["trend_points"],
        "trend_max": trend["trend_max"],
        "cost_points": trend["cost_points"],
        "cost_max": trend["cost_max"],
        "trend_ma_last": trend["trend_ma"][-1] if trend["trend_ma"] else None,
        "cost_ma_last": trend["cost_ma"][-1] if trend["cost_ma"] else None,
        "next_recommended_km": next_fill_up.recommended_odometer_km if next_fill_up else None,
        "next_fill_up": next_fill_up,
        "period_summary": period_summary,
        "review_form": review_form,
        "review_suggestion": review_suggestion,
        "selected_motorcycle": selected_motorcycle,
        "fuel_stations": FuelStation.objects.filter(owner=request.user),
        "fuel_types": FuelType.choices,
        "filters": {
            "q": q,
            "motorcycle": motorcycle_id or "",
            "station": station_id or "",
            "fuel_type": fuel_type,
            "start": request.GET.get("start") or "",
            "end": request.GET.get("end") or "",
        },
        "density": density,
    }
    return render(request, "fuel/list.html", context)


@login_required
@pro_required("Exportacao de abastecimentos")
def fuel_export_view(request):
    fmt = (request.GET.get("format") or "csv").strip().lower()
    if fmt not in {"csv", "xlsx", "pdf"}:
        fmt = "csv"
    start = parse_date_param(request.GET.get("start"))
    end = parse_date_param(request.GET.get("end"))
    email_to = request.user.email if request.GET.get("email") == "1" else None
    return build_export(
        user=request.user,
        start=start,
        end=end,
        fmt=fmt,
        email_to=email_to,
        motorcycle_id=request.GET.get("motorcycle") or None,
        station_id=request.GET.get("station") or None,
        fuel_type=request.GET.get("fuel_type") or "",
    )


@login_required
def fuel_import_preview_view(request):
    from apps.garage.models import Motorcycle

    motorcycles = Motorcycle.objects.filter(owner=request.user, is_active=True).order_by("name")
    preview_rows = []
    import_token = ""  # nosec B105 - CSV idempotency token (random string set below), not a password
    selected_motorcycle = None
    if request.method == "POST":
        try:
            motorcycle_id = int(request.POST.get("motorcycle") or 0)
        except (ValueError, TypeError):
            motorcycle_id = 0
        selected_motorcycle = get_object_or_404(motorcycles, pk=motorcycle_id)
        upload = request.FILES.get("file")
        if not upload:
            messages.error(request, "Selecione um CSV para importar.")
        else:
            preview_rows = preview_fuel_csv(file_obj=upload.file, motorcycle=selected_motorcycle)
            valid_rows = [row.data for row in preview_rows if row.is_valid]
            import_token = secrets.token_urlsafe(12)
            imports = request.session.get("fuel_imports", {})
            imports[import_token] = {"motorcycle_id": selected_motorcycle.pk, "rows": valid_rows}
            request.session["fuel_imports"] = imports
            request.session.modified = True
    return render(
        request,
        "fuel/import_preview.html",
        {
            "motorcycles": motorcycles,
            "selected_motorcycle": selected_motorcycle,
            "preview_rows": preview_rows,
            "import_token": import_token,
        },
    )


@login_required
def fuel_import_confirm_view(request):
    from apps.garage.models import Motorcycle

    if request.method != "POST":
        return redirect("fuel:import_preview")
    token = request.POST.get("import_token") or ""
    imports = request.session.get("fuel_imports", {})
    payload = imports.get(token)
    if not payload:
        messages.error(request, "Prévia de importação expirada.")
        return redirect("fuel:import_preview")
    motorcycle = get_object_or_404(Motorcycle, pk=payload["motorcycle_id"], owner=request.user, is_active=True)
    try:
        created = create_fuel_records_from_rows(motorcycle=motorcycle, rows=payload["rows"])
    except ValidationError as exc:
        messages.error(request, " ".join(exc.messages))
        return redirect("fuel:import_preview")
    imports.pop(token, None)
    request.session["fuel_imports"] = imports
    request.session.modified = True
    messages.success(request, f"{created} abastecimento(s) importado(s) com sucesso.")
    return redirect("fuel:list")


@login_required
def fuel_catalog_view(request):
    stations = FuelStation.objects.filter(owner=request.user)
    grades = FuelGrade.objects.filter(owner=request.user)
    recent_records = (
        FuelRecord.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
        .select_related("station", "fuel_grade", "motorcycle")
        .order_by("-date", "-odometer_km")
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
    configure_form_accessibility(form)

    total_stations = FuelStation.objects.filter(owner=request.user).count()

    return render(
        request, "fuel/station_form.html", {"form": form, "title": "Novo posto", "submit_label": "Salvar posto", "total_stations": total_stations}
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
    configure_form_accessibility(form)

    total_stations = FuelStation.objects.filter(owner=request.user).count()

    return render(
        request,
        "fuel/station_form.html",
        {"form": form, "title": f"Editar {station.name}", "submit_label": "Salvar alterações", "station": station, "total_stations": total_stations},
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
            messages.success(request, f"Combustível {grade.name} criado com sucesso.")
            return redirect("fuel:catalogs")
    else:
        form = FuelGradeForm()
    configure_form_accessibility(form)

    total_grades = FuelGrade.objects.filter(owner=request.user).count()

    return render(
        request, "fuel/grade_form.html", {"form": form, "title": "Novo combustível", "submit_label": "Salvar combustível", "total_grades": total_grades}
    )


@login_required
def fuel_grade_update_view(request, pk: int):
    grade = get_object_or_404(FuelGrade, pk=pk, owner=request.user)
    if request.method == "POST":
        form = FuelGradeForm(request.POST, instance=grade)
        if form.is_valid():
            form.save()
            messages.success(request, f"Combustível {grade.name} atualizado com sucesso.")
            return redirect("fuel:catalogs")
    else:
        form = FuelGradeForm(instance=grade)
    configure_form_accessibility(form)

    total_grades = FuelGrade.objects.filter(owner=request.user).count()

    return render(
        request,
        "fuel/grade_form.html",
        {"form": form, "title": f"Editar {grade.name}", "submit_label": "Salvar alterações", "grade": grade, "total_grades": total_grades},
    )


@login_required
def fuel_grade_delete_view(request, pk: int):
    grade = get_object_or_404(FuelGrade, pk=pk, owner=request.user)
    if request.method == "POST":
        name = grade.name
        grade.delete()
        messages.success(request, f"Combustível {name} removido com sucesso.")
        return redirect("fuel:catalogs")
    return render(request, "fuel/grade_confirm_delete.html", {"grade": grade})


def _add_fuel_save_alerts(request, record: FuelRecord) -> None:
    from apps.core.services.notifications import notification_alerts_for_motorcycle
    from apps.reports.services import intelligent_alerts

    fuel_alerts = [
        alert
        for alert in intelligent_alerts(user=request.user, motorcycle=record.motorcycle)
        if alert.source in {"fuel", "maintenance"}
    ][:2]
    for alert in fuel_alerts:
        messages.info(request, alert.message)
    for alert in notification_alerts_for_motorcycle(
        record.motorcycle,
        limit=3,
        current_odometer_km=record.motorcycle.current_odometer_km,
    ):
        if alert.source in {"maintenance", "documents", "reminder", "tires"}:
            messages.info(request, alert.message)


def _save_fuel_record_from_form(request, form, *, success_message: str) -> FuelRecord:
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
    if request.FILES.get("receipt_file") and not can_add_uploads(request.user):
        form.instance.receipt_file = ""
        messages.info(
            request,
            "Abastecimento salvo sem recibo: o Plano Free permite ate 3 documentos, fotos ou recibos. O Plano Pro libera armazenamento profissional.",
        )
    record = form.save()
    record.motorcycle.refresh_from_db(fields=["current_odometer_km"])
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
    _add_fuel_save_alerts(request, record)
    messages.success(request, success_message.format(record=record))
    return record


@login_required
def fuel_record_update_view(request, pk: int):
    record = get_object_or_404(FuelRecord, pk=pk, motorcycle__owner=request.user)
    if request.method == "POST":
        existing_receipt_name = record.receipt_file.name
        form = FuelRecordQuickForm(request.POST, request.FILES, user=request.user, instance=record)
        if form.is_valid():
            if request.FILES.get("receipt_file") and not can_add_uploads(
                request.user, incoming_count=0 if existing_receipt_name else 1
            ):
                form.instance.receipt_file = existing_receipt_name
                messages.info(request, "Alteracao salva sem novo recibo porque o limite do Plano Free foi atingido.")
            updated = form.save()
            remember_fuel_preference(updated)
            _add_fuel_save_alerts(request, updated)
            messages.success(request, f"Abastecimento de {updated.motorcycle.name} atualizado com sucesso.")
            return redirect("fuel:list")
    else:
        form = FuelRecordQuickForm(user=request.user, instance=record)

    configure_form_accessibility(form)

    streak_count = FuelRecord.objects.filter(
        motorcycle__owner=request.user
    ).values('motorcycle').distinct().count()
    total_records = FuelRecord.objects.filter(motorcycle__owner=request.user).count()

    return render(
        request,
        "fuel/record_form.html",
        {
            "form": form,
            "record": record,
            "title": "Editar abastecimento",
            "submit_label": "Salvar alterações",
            "streak_count": streak_count,
            "total_records": total_records,
        },
    )


@login_required
def fuel_record_delete_view(request, pk: int):
    record = get_object_or_404(FuelRecord, pk=pk, motorcycle__owner=request.user)
    if request.method == "POST":
        motorcycle_name = record.motorcycle.name
        record.delete()
        messages.success(request, f"Abastecimento de {motorcycle_name} removido com sucesso.")
        return redirect("fuel:list")
    return render(request, "fuel/record_confirm_delete.html", {"record": record})


@login_required
def fuel_review_settings_view(request):
    if request.method != "POST":
        return redirect("fuel:list")

    active_motorcycle = get_active_motorcycle(request)
    try:
        motorcycle_id = int(request.POST.get("motorcycle") or (active_motorcycle.pk if active_motorcycle else 0))
    except (ValueError, TypeError):
        motorcycle_id = active_motorcycle.pk if active_motorcycle else 0
    from apps.garage.models import Motorcycle

    motorcycle = get_object_or_404(Motorcycle, pk=motorcycle_id, owner=request.user, is_active=True)
    preference, _ = FuelReviewPreference.objects.get_or_create(motorcycle=motorcycle)
    form = FuelReviewPreferenceForm(request.POST, instance=preference)
    if form.is_valid():
        form.save()
        messages.success(request, "Regra de revisão por abastecimentos atualizada com sucesso.")
    else:
        messages.error(request, "Revise a regra de revisão por abastecimentos.")

    return redirect(safe_next_url(request=request, candidate=request.POST.get("next"), fallback="fuel:list"))


@login_required
def fuel_quick_create_view(request):
    is_htmx = request.headers.get("HX-Request") == "true"
    active_motorcycle = get_active_motorcycle(request)
    prefill = (request.GET.get("prefill") or "").strip().lower()

    if request.method == "POST":
        completed, submission_token = completed_client_submission(request, action="fuel:quick_create")
        next_url = safe_next_url(
            request=request,
            candidate=request.GET.get("next") or request.POST.get("next"),
            fallback="/" if is_htmx else "fuel:list",
        )
        if completed:
            if is_htmx:
                response = HttpResponse()
                response["HX-Redirect"] = next_url
                return response
            return redirect(next_url)
        form = FuelRecordQuickForm(request.POST, request.FILES, user=request.user)
        if form.is_valid():
            with transaction.atomic():
                submission, should_process = claim_client_submission(
                    request,
                    token=submission_token,
                    action="fuel:quick_create",
                )
                if not should_process:
                    if is_htmx:
                        response = HttpResponse()
                        response["HX-Redirect"] = next_url
                        return response
                    return redirect(next_url)
                record = _save_fuel_record_from_form(
                    request,
                    form,
                    success_message="Abastecimento registrado para {record.motorcycle.name}.",
                )
                record_client_submission(
                    request,
                    token=submission_token,
                    action="fuel:quick_create",
                    result=record,
                    submission=submission,
                )
            if is_htmx:
                response = HttpResponse()
                response["HX-Redirect"] = next_url
                return response
            return redirect(next_url)
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

    last_odometer_km = None
    if active_motorcycle:
        last_record = (
            FuelRecord.objects.filter(motorcycle=active_motorcycle)
            .order_by("-date", "-odometer_km")
            .first()
        )
        if last_record:
            last_odometer_km = last_record.odometer_km

    context = {
        "form": form,
        "title": "Adicionar abastecimento",
        "submit_label": "Salvar abastecimento",
        "next_url": request.GET.get("next") or request.POST.get("next") or "",
        "can_prefill_last": bool(active_motorcycle),
        "form_action_url": reverse("fuel:quick_create"),
        "last_odometer_km": last_odometer_km,
        "client_submission_id": client_submission_token_for_form(request),
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
        form = FuelRecordRepeatForm(request.POST, request.FILES, user=request.user)
        if form.is_valid():
            _save_fuel_record_from_form(
                request,
                form,
                success_message="Abastecimento repetido para {record.motorcycle.name}.",
            )
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
        "form_action_url": reverse("fuel:repeat_last"),
        "next_url": request.GET.get("next") or request.POST.get("next") or "",
        "repeat_summary": {
            "station_name": last.station_name or (last.station.name if last.station else ""),
            "fuel_type": last.get_fuel_type_display(),
        },
        "last_odometer_km": last.odometer_km,
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
