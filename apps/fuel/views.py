from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import redirect, render

from .forms import FuelRecordQuickForm
from .models import FuelGrade, FuelRecord, FuelStation


def _configure_form_accessibility(form):
	for bound_field in form.visible_fields():
		widget_attrs = bound_field.field.widget.attrs
		describedby_ids = []
		if bound_field.help_text:
			describedby_ids.append(f"{bound_field.id_for_label}_help")
		if bound_field.errors:
			widget_attrs["aria-invalid"] = "true"
			describedby_ids.append(f"{bound_field.id_for_label}_error")
		else:
			widget_attrs.pop("aria-invalid", None)

		if describedby_ids:
			widget_attrs["aria-describedby"] = " ".join(describedby_ids)
		else:
			widget_attrs.pop("aria-describedby", None)


@login_required
def fuel_list_view(request):
	records = FuelRecord.objects.filter(motorcycle__owner=request.user).select_related("motorcycle")
	return render(request, "fuel/list.html", {"records": records})


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
	_configure_form_accessibility(form)
	return render(request, "fuel/partials/quick_form.html", context, status=status)
