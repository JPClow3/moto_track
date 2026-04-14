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

	last_record = records_qs.first()

	context = {
		"records": records,
		"page_obj": paged.page,
		"month_total": month_total,
		"total_spend": total_spend,
		"total_liters": total_liters,
		"avg_cost_per_km": avg_cost_per_km,
		"last_record": last_record,
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
