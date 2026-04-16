from django.contrib.auth.decorators import login_required
from django.db.models import Avg, Max, Min, Sum
from django.shortcuts import render
from djmoney.money import Money

from apps.expenses.models import AnnualFee, InsurancePolicy
from apps.fuel.models import FuelRecord
from apps.maintenance.models import MaintenanceRecord
from apps.tires.models import TireRecord


def _amount_to_float(value) -> float:
	amount = getattr(value, "amount", value)
	try:
		return float(amount or 0)
	except (TypeError, ValueError):
		return 0.0


@login_required
def report_overview_view(request):
	fuel_qs = FuelRecord.objects.filter(
		motorcycle__owner=request.user, motorcycle__is_active=True
	)  # pylint: disable=no-member
	maintenance_qs = MaintenanceRecord.objects.filter(
		motorcycle__owner=request.user, motorcycle__is_active=True
	)  # pylint: disable=no-member
	tires_qs = TireRecord.objects.filter(
		motorcycle__owner=request.user, motorcycle__is_active=True
	)  # pylint: disable=no-member
	fees_qs = AnnualFee.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
	policies_qs = InsurancePolicy.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)

	fuel_total = fuel_qs.aggregate(total=Sum("total_price"))["total"] or Money(0, "BRL")
	maintenance_total = maintenance_qs.aggregate(total=Sum("cost"))["total"] or Money(0, "BRL")
	tires_total = tires_qs.aggregate(total=Sum("cost"))["total"] or Money(0, "BRL")
	annual_fees_total = fees_qs.aggregate(total=Sum("amount"))["total"] or Money(0, "BRL")
	insurance_premiums_total = policies_qs.aggregate(total=Sum("premium"))["total"] or Money(0, "BRL")

	spans = fuel_qs.values("motorcycle_id").annotate(min_odo=Min("odometer_km"), max_odo=Max("odometer_km"))
	total_km = 0
	for row in spans:
		if row["min_odo"] is None or row["max_odo"] is None:
			continue
		total_km += max(int(row["max_odo"]) - int(row["min_odo"]), 0)

	currency = getattr(fuel_total, "currency", "BRL")
	total_cost_amount = (
		_amount_to_float(fuel_total)
		+ _amount_to_float(maintenance_total)
		+ _amount_to_float(tires_total)
		+ _amount_to_float(annual_fees_total)
		+ _amount_to_float(insurance_premiums_total)
	)
	total_cost = Money(total_cost_amount, currency)
	cpk = None
	if total_km > 0:
		cpk = round(float(total_cost.amount) / total_km, 3)

	context = {
		"fuel_total": fuel_total,
		"maintenance_total": maintenance_total,
		"tires_total": tires_total,
		"annual_fees_total": annual_fees_total,
		"insurance_premiums_total": insurance_premiums_total,
		"total_cost": total_cost,
		"total_km": total_km,
		"cpk": cpk,
		"avg_odometer_km": fuel_qs.aggregate(avg=Avg("odometer_km"))["avg"],
		"fuel_records_count": fuel_qs.count(),
		"maintenance_records_count": maintenance_qs.count(),
		"tires_records_count": tires_qs.count(),
		"annual_fees_count": fees_qs.count(),
		"insurance_policies_count": policies_qs.count(),
	}
	return render(request, "reports/overview.html", context)
