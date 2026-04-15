from datetime import date

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from djmoney.money import Money

from .forms import FuelGradeForm, FuelRecordQuickForm, FuelStationForm
from django.db.models import Q

from .models import FuelGrade, FuelRecord, FuelStation
from apps.core.forms import configure_form_accessibility
from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.pagination import paginate


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
	records_qs = FuelRecord.objects.filter(motorcycle__owner=request.user).select_related("motorcycle").order_by("-date", "-odometer_km")

	motorcycle_id = request.GET.get("motorcycle")
	if motorcycle_id:
		records_qs = records_qs.filter(motorcycle_id=motorcycle_id)

	q = (request.GET.get("q") or "").strip()
	if q:
		records_qs = records_qs.filter(Q(station_name__icontains=q) | Q(notes__icontains=q))

	paged = paginate(request, records_qs, per_page=50)
	records = paged.items
	now = timezone.now()
	month_total = records_qs.filter(date__year=now.year, date__month=now.month).aggregate(total=Sum("total_price"))["total"] or Money(0, "BRL")
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

	trend_points = []
	values = []
	for year, month in months:
		b = trend_buckets[(year, month)]
		span = (b["max_odo"] - b["min_odo"]) if (b["min_odo"] is not None and b["max_odo"] is not None) else 0
		value = None
		if span > 0 and b["liters"] > 0:
			value = round(b["liters"] / span * 100, 2)
			values.append(value)
		trend_points.append({"label": _format_month_label(year, month), "value": value})

	trend_max = max(values) if values else None

	# "Next recommended fill-up" heuristic: average distance between last few fill-ups.
	next_recommended_km = None
	if len(records) >= 2:
		pairs = list(zip(records, records[1:]))
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
		"next_recommended_km": next_recommended_km,
		"filters": {"q": q, "motorcycle": motorcycle_id or ""},
	}
	return render(request, "fuel/list.html", context)


@login_required
def fuel_catalog_view(request):
	stations = FuelStation.objects.filter(owner=request.user)
	grades = FuelGrade.objects.filter(owner=request.user)
	return render(request, "fuel/catalogs.html", {"stations": stations, "grades": grades})


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

	return render(request, "fuel/station_form.html", {"form": form, "title": "Novo posto", "submit_label": "Salvar posto"})


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
	return render(request, "fuel/grade_form.html", {"form": form, "title": "Nova grade", "submit_label": "Salvar grade"})


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

	if request.method == "POST":
		form = FuelRecordQuickForm(request.POST, user=request.user)
		if form.is_valid():
			record = form.save()
			messages.success(request, f"Abastecimento registrado para {record.motorcycle.name}.")
			if is_htmx:
				response = HttpResponse()
				response["HX-Redirect"] = request.GET.get("next") or request.POST.get("next") or "/"
				return response
			return redirect(request.POST.get("next") or "fuel:list")
		status = 422 if is_htmx else 200
	else:
		initial = {"next": request.GET.get("next") or ""}
		if active_motorcycle:
			initial["motorcycle"] = active_motorcycle
		form = FuelRecordQuickForm(user=request.user, initial=initial)
		status = 200

	context = {
		"form": form,
		"title": "Adicionar abastecimento",
		"submit_label": "Salvar abastecimento",
		"next_url": request.GET.get("next") or request.POST.get("next") or "",
	}
	configure_form_accessibility(form)
	return render(request, "fuel/partials/quick_form.html", context, status=status)
