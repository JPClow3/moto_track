from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.shortcuts import redirect, render

from .forms import MaintenanceRecordQuickForm
from .models import MaintenancePart, MaintenanceRecord, MaintenanceRecordPart


@login_required
def maintenance_list_view(request):
	records = MaintenanceRecord.objects.filter(motorcycle__owner=request.user).select_related("motorcycle")
	return render(request, "maintenance/list.html", {"records": records})


@login_required
def maintenance_catalog_view(request):
	parts = MaintenancePart.objects.filter(owner=request.user)
	return render(request, "maintenance/catalogs.html", {"parts": parts})


@login_required
def maintenance_quick_create_view(request):
	is_htmx = request.headers.get("HX-Request") == "true"

	if request.method == "POST":
		form = MaintenanceRecordQuickForm(request.POST, user=request.user)
		if form.is_valid():
			parts = list(form.cleaned_data.pop("parts", []))
			record = form.save()
			for part in parts:
				MaintenanceRecordPart.objects.get_or_create(maintenance_record=record, part=part)
			messages.success(request, f"Manutenção registrada para {record.motorcycle.name}.")
			if is_htmx:
				response = HttpResponse()
				response["HX-Redirect"] = request.GET.get("next") or request.POST.get("next") or "/"
				return response
			return redirect(request.POST.get("next") or "maintenance:list")
		status = 422 if is_htmx else 200
	else:
		initial = {"next": request.GET.get("next") or ""}
		form = MaintenanceRecordQuickForm(user=request.user, initial=initial)
		status = 200

	context = {
		"form": form,
		"title": "Registrar manutenção",
		"submit_label": "Salvar manutenção",
		"next_url": request.GET.get("next") or request.POST.get("next") or "",
	}
	return render(request, "maintenance/partials/quick_form.html", context, status=status)
