from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone

from .forms import FuelRecordQuickForm
from .models import FuelGrade, FuelRecord, FuelStation
from apps.core.forms import configure_form_accessibility





@login_required
def fuel_list_view(request):
	records_qs = FuelRecord.objects.filter(motorcycle__owner=request.user).select_related("motorcycle")
	records = list(records_qs)
	now = timezone.now()
	month_total = records_qs.filter(date__year=now.year, date__month=now.month).aggregate(total=Sum("total_price"))["total"] or 0
	total_spend = records_qs.aggregate(total=Sum("total_price"))["total"] or 0
	total_liters = records_qs.aggregate(total=Sum("liters"))["total"] or 0

	odometer_span = 0
	if len(records) > 1:
		odometer_values = [record.odometer_km for record in records]
		odometer_span = max(odometer_values) - min(odometer_values)

	avg_cost_per_km = None
	if odometer_span > 0:
		avg_cost_per_km = round(float(total_spend) / odometer_span, 3)

	last_record = records[0] if records else None

	context = {
		"records": records,
		"month_total": month_total,
		"total_spend": total_spend,
		"total_liters": total_liters,
		"avg_cost_per_km": avg_cost_per_km,
		"last_record": last_record,
	}
	return render(request, "fuel/list.html", context)


@login_required
def fuel_catalog_view(request):
	stations = FuelStation.objects.filter(owner=request.user)
	grades = FuelGrade.objects.filter(owner=request.user)
	return render(request, "fuel/catalogs.html", {"stations": stations, "grades": grades})


@login_required
def fuel_quick_create_view(request):
	is_htmx = request.headers.get("HX-Request") == "true"

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
