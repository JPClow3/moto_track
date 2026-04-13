from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.utils import timezone
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse

from .forms import OdometerOverrideForm
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.reminders.models import Reminder
from apps.tires.models import TirePosition, TireRecord


@login_required
def dashboard_view(request):
	motorcycle = Motorcycle.objects.filter(owner=request.user).first()
	latest_fuel = FuelRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km").first() if motorcycle else None
	recent_fuels = list(FuelRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")[:3]) if motorcycle else []
	recent_maintenance = list(MaintenanceRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")[:3]) if motorcycle else []
	active_reminders = list(Reminder.objects.filter(motorcycle=motorcycle, is_active=True).order_by("reference_date", "reference_km")[:4]) if motorcycle else []
	last_oil = (
		MaintenanceRecord.objects.filter(motorcycle=motorcycle, maintenance_type=MaintenanceType.OIL_CHANGE)
		.order_by("-date", "-odometer_km")
		.first()
		if motorcycle
		else None
	)
	rear_tire = (
		TireRecord.objects.filter(motorcycle=motorcycle, position=TirePosition.REAR, is_active=True)
		.order_by("-installed_at")
		.first()
		if motorcycle
		else None
	)
	now = timezone.now()
	month_total = (
		FuelRecord.objects.filter(motorcycle=motorcycle, date__year=now.year, date__month=now.month).aggregate(total=Sum("total_price"))["total"]
		if motorcycle
		else 0
	)
	pending_alerts = len(active_reminders)

	quick_actions = [
		{
			"label": "Adicionar abastecimento",
			"hint": "Registre em segundos",
			"url": reverse("fuel:list"),
			"htmx_url": reverse("fuel:quick_create"),
			"tone": "primary",
		},
		{
			"label": "Registrar manutenção",
			"hint": "Preventiva ou corretiva",
			"url": reverse("maintenance:list"),
			"htmx_url": reverse("maintenance:quick_create"),
			"tone": "secondary",
		},
		{
			"label": "Atualizar odômetro",
			"hint": "Ajuste manual",
			"url": reverse("dashboard"),
			"htmx_url": reverse("quick_odometer_update"),
			"tone": "secondary",
		},
		{"label": "Abrir manual", "hint": "Consulta rápida", "url": reverse("documents:list"), "tone": "secondary"},
	]
	catalog_links = [
		{"label": "Catálogos de combustível", "hint": "Postos e grades", "url": reverse("fuel:catalogs")},
		{"label": "Catálogos de manutenção", "hint": "Peças e insumos", "url": reverse("maintenance:catalogs")},
		{"label": "Catálogos de pneus", "hint": "Produtos e especificações", "url": reverse("tires:catalogs")},
	]

	context = {
		"motorcycle": motorcycle,
		"quick_actions": quick_actions,
		"catalog_links": catalog_links,
		"recent_fuels": recent_fuels,
		"recent_maintenance": recent_maintenance,
		"active_reminders": active_reminders,
		"month_total": month_total or 0,
		"pending_alerts": pending_alerts,
		"cards": [
			{
				"title": "Odometro atual",
				"value": f"{motorcycle.current_odometer_km} km" if motorcycle else "Sem moto cadastrada",
				"subtitle": motorcycle.name if motorcycle else "Cadastre sua moto para iniciar",
			},
			{
				"title": "Proxima troca de oleo",
				"value": (
					f"em {max(last_oil.computed_next_change_km - motorcycle.current_odometer_km, 0)} km"
					if last_oil and last_oil.computed_next_change_km and motorcycle
					else "Nao definida"
				),
				"subtitle": (
					f"Meta: {last_oil.computed_next_change_km} km" if last_oil and last_oil.computed_next_change_km else "Registre uma manutencao"
				),
			},
			{
				"title": "Ultimo abastecimento",
				"value": f"R$ {latest_fuel.total_price}" if latest_fuel else "Sem registro",
				"subtitle": (
					f"{latest_fuel.liters} L em {latest_fuel.date}" if latest_fuel else "Adicione um abastecimento"
				),
			},
			{
				"title": "Pneu traseiro",
				"value": f"Desgaste: {rear_tire.wear_percent}%" if rear_tire else "Sem registro",
				"subtitle": (
					f"{rear_tire.brand_model}" if rear_tire else "Cadastre o pneu traseiro"
				),
			},
			{
				"title": "Gasto do mês (combustível)",
				"value": f"R$ {month_total or 0}",
				"subtitle": "Acumulado do mes",
			},
			{
				"title": "Alertas pendentes",
				"value": str(pending_alerts),
				"subtitle": "Lembretes ativos",
			},
		]
	}
	return render(request, "core/dashboard.html", context)


@login_required
def odometer_quick_update_view(request):
	motorcycle = Motorcycle.objects.filter(owner=request.user).first()
	is_htmx = request.headers.get("HX-Request") == "true"

	if not motorcycle:
		messages.error(request, "Cadastre uma moto antes de atualizar o odômetro.")
		if is_htmx:
			response = HttpResponse()
			response["HX-Redirect"] = reverse("dashboard")
			return response
		return redirect("dashboard")

	if request.method == "POST":
		form = OdometerOverrideForm(request.POST, motorcycle=motorcycle)
		if form.is_valid():
			form.save()
			messages.success(request, "Odômetro atualizado com sucesso.")
			if is_htmx:
				response = HttpResponse()
				response["HX-Redirect"] = request.GET.get("next") or request.POST.get("next") or reverse("dashboard")
				return response
			return redirect(request.POST.get("next") or "dashboard")
		status = 422 if is_htmx else 200
	else:
		form = OdometerOverrideForm(
			motorcycle=motorcycle,
			initial={
				"odometer_override_km": motorcycle.current_odometer_km,
				"next": request.GET.get("next") or "",
			},
		)
		status = 200

	context = {
		"form": form,
		"title": "Atualizar odômetro",
		"submit_label": "Salvar odômetro",
		"next_url": request.GET.get("next") or request.POST.get("next") or reverse("dashboard"),
	}
	return render(request, "core/partials/odometer_form.html", context, status=status)
