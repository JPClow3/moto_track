from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from dal import autocomplete

from djmoney.money import Money

from .forms import MaintenancePartForm, MaintenanceRecordQuickForm
from .models import MaintenancePart, MaintenanceRecord, MaintenanceRecordPart
from apps.core.forms import configure_form_accessibility
from apps.core.active_motorcycle import get_active_motorcycle
from apps.core.pagination import paginate


class MaintenancePartAutocomplete(autocomplete.Select2QuerySetView):
	def get_queryset(self):
		if not self.request.user.is_authenticated:
			return MaintenancePart.objects.none()

		queryset = MaintenancePart.objects.filter(owner=self.request.user).order_by("name")
		if self.q:
			queryset = queryset.filter(name__icontains=self.q)
		return queryset





@login_required
def maintenance_list_view(request):
	records_qs = (
		MaintenanceRecord.objects.filter(motorcycle__owner=request.user)
		.select_related("motorcycle")
		.order_by("-date", "-odometer_km")
	)

	motorcycle_id = request.GET.get("motorcycle")
	if motorcycle_id:
		records_qs = records_qs.filter(motorcycle_id=motorcycle_id)

	paged = paginate(request, records_qs, per_page=50)
	records = paged.items
	total_cost = records_qs.aggregate(total=Sum("cost"))["total"] or Money(0, "BRL")
	latest_record = records[0] if records else None
	context = {
		"records": records,
		"page_obj": paged.page,
		"total_cost": total_cost,
		"records_count": records_qs.count(),
		"latest_record": latest_record,
		"filters": {"motorcycle": motorcycle_id or ""},
	}
	return render(request, "maintenance/list.html", context)


@login_required
def maintenance_catalog_view(request):
	parts = MaintenancePart.objects.filter(owner=request.user)
	return render(request, "maintenance/catalogs.html", {"parts": parts})


@login_required
def maintenance_part_create_view(request):
	if request.method == "POST":
		form = MaintenancePartForm(request.POST)
		if form.is_valid():
			part = form.save(commit=False)
			part.owner = request.user
			part.save()
			messages.success(request, f"Peça {part.name} criada com sucesso.")
			return redirect("maintenance:catalogs")
	else:
		form = MaintenancePartForm()
	return render(request, "maintenance/part_form.html", {"form": form, "title": "Nova peça", "submit_label": "Salvar peça"})


@login_required
def maintenance_part_update_view(request, pk: int):
	part = get_object_or_404(MaintenancePart, pk=pk, owner=request.user)
	if request.method == "POST":
		form = MaintenancePartForm(request.POST, instance=part)
		if form.is_valid():
			form.save()
			messages.success(request, f"Peça {part.name} atualizada com sucesso.")
			return redirect("maintenance:catalogs")
	else:
		form = MaintenancePartForm(instance=part)
	return render(
		request,
		"maintenance/part_form.html",
		{"form": form, "title": f"Editar {part.name}", "submit_label": "Salvar alterações", "part": part},
	)


@login_required
def maintenance_part_delete_view(request, pk: int):
	part = get_object_or_404(MaintenancePart, pk=pk, owner=request.user)
	if request.method == "POST":
		name = part.name
		part.delete()
		messages.success(request, f"Peça {name} removida com sucesso.")
		return redirect("maintenance:catalogs")
	return render(request, "maintenance/part_confirm_delete.html", {"part": part})


@login_required
def maintenance_quick_create_view(request):
	is_htmx = request.headers.get("HX-Request") == "true"
	active_motorcycle = get_active_motorcycle(request)

	if request.method == "POST":
		form = MaintenanceRecordQuickForm(request.POST, user=request.user)
		if form.is_valid():
			parts = form.cleaned_data.pop("parts", [])
			record = form.save()  # parts is not a model field, so this is safe
			if parts:
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
		if active_motorcycle:
			initial["motorcycle"] = active_motorcycle
		form = MaintenanceRecordQuickForm(user=request.user, initial=initial)
		status = 200

	context = {
		"form": form,
		"title": "Registrar manutenção",
		"submit_label": "Salvar manutenção",
		"next_url": request.GET.get("next") or request.POST.get("next") or "",
	}
	configure_form_accessibility(form)
	return render(request, "maintenance/partials/quick_form.html", context, status=status)
