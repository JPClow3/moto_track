from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import redirect, render
from dal import autocomplete

from .forms import MaintenanceRecordQuickForm
from .models import MaintenancePart, MaintenanceRecord, MaintenanceRecordPart


class MaintenancePartAutocomplete(autocomplete.Select2QuerySetView):
	def get_queryset(self):
		if not self.request.user.is_authenticated:
			return MaintenancePart.objects.none()

		queryset = MaintenancePart.objects.filter(owner=self.request.user).order_by("name")
		if self.q:
			queryset = queryset.filter(name__icontains=self.q)
		return queryset


def _configure_form_accessibility(form):
	for bound_field in form.visible_fields():
		widget_attrs = bound_field.field.widget.attrs
		if bound_field.field.required:
			widget_attrs["aria-required"] = "true"
		else:
			widget_attrs.pop("aria-required", None)

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
def maintenance_list_view(request):
	records_qs = MaintenanceRecord.objects.filter(motorcycle__owner=request.user).select_related("motorcycle")
	records = list(records_qs)
	total_cost = records_qs.aggregate(total=Sum("cost"))["total"] or 0
	latest_record = records[0] if records else None
	context = {
		"records": records,
		"total_cost": total_cost,
		"records_count": len(records),
		"latest_record": latest_record,
	}
	return render(request, "maintenance/list.html", context)


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
	_configure_form_accessibility(form)
	return render(request, "maintenance/partials/quick_form.html", context, status=status)
