from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Sum
from django.shortcuts import render

from apps.fuel.models import FuelRecord
from apps.maintenance.models import MaintenanceRecord


@login_required
def report_overview_view(request):
	fuel_qs = FuelRecord.objects.filter(motorcycle__owner=request.user)
	maintenance_qs = MaintenanceRecord.objects.filter(motorcycle__owner=request.user)
	context = {
		"fuel_total": fuel_qs.aggregate(total=Sum("total_price"))["total"] or 0,
		"maintenance_total": maintenance_qs.aggregate(total=Sum("cost"))["total"] or 0,
		"avg_odometer_km": fuel_qs.aggregate(avg=Avg("odometer_km"))["avg"],
		"fuel_records_count": fuel_qs.count(),
		"maintenance_records_count": maintenance_qs.count(),
	}
	return render(request, "reports/overview.html", context)
