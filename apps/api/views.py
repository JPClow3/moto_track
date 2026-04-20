from __future__ import annotations

from django.http import JsonResponse
from django.utils import timezone

from apps.core.models import ApiToken
from apps.documents.models import MotorcycleDocument
from apps.expenses.models import AnnualFee, InsurancePolicy
from apps.fuel.models import FuelRecord
from apps.maintenance.models import MaintenanceRecord
from apps.reminders.models import Reminder
from apps.tires.models import TireRecord


def _token_from_request(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Token "):
        return None
    key = auth.removeprefix("Token ").strip()
    token = ApiToken.objects.filter(key=key, is_active=True).select_related("owner").first()
    if token:
        ApiToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())
    return token


def _require_token(request, scope: str):
    token = _token_from_request(request)
    if not token:
        return None, JsonResponse({"detail": "Token ausente ou invÃ¡lido."}, status=401)
    if not token.has_scope(scope):
        return None, JsonResponse({"detail": "Token sem permissÃ£o para este recurso."}, status=403)
    return token, None


def _page(request, qs, serializer):
    limit = min(max(int(request.GET.get("limit", 50) or 50), 1), 100)
    offset = max(int(request.GET.get("offset", 0) or 0), 0)
    total = qs.count()
    return JsonResponse(
        {
            "count": total,
            "limit": limit,
            "offset": offset,
            "results": [serializer(obj) for obj in qs[offset : offset + limit]],
        }
    )


def _fuel(record: FuelRecord) -> dict:
    return {
        "id": record.pk,
        "motorcycle": record.motorcycle.name,
        "date": record.date.isoformat(),
        "odometer_km": record.odometer_km,
        "liters": str(record.liters),
        "total_price": str(record.total_price),
        "fuel_type": record.fuel_type,
        "station_name": record.station_name or (record.station.name if record.station else ""),
    }


def fuel_records(request):
    token, error = _require_token(request, "fuel:read")
    if error:
        return error
    qs = FuelRecord.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True).select_related(
        "motorcycle", "station"
    )
    return _page(request, qs, _fuel)


def maintenance_records(request):
    token, error = _require_token(request, "maintenance:read")
    if error:
        return error
    qs = MaintenanceRecord.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True).select_related("motorcycle")
    return _page(
        request,
        qs,
        lambda r: {
            "id": r.pk,
            "motorcycle": r.motorcycle.name,
            "date": r.date.isoformat(),
            "odometer_km": r.odometer_km,
            "maintenance_type": r.maintenance_type,
            "cost": str(r.cost),
        },
    )


def tire_records(request):
    token, error = _require_token(request, "tires:read")
    if error:
        return error
    qs = TireRecord.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True).select_related("motorcycle")
    return _page(
        request,
        qs,
        lambda r: {
            "id": r.pk,
            "motorcycle": r.motorcycle.name,
            "installed_at": r.installed_at.isoformat(),
            "position": r.position,
            "brand_model": r.brand_model,
            "cost": str(r.cost),
        },
    )


def reminders(request):
    token, error = _require_token(request, "reminders:read")
    if error:
        return error
    qs = Reminder.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True).select_related("motorcycle")
    return _page(request, qs, lambda r: {"id": r.pk, "motorcycle": r.motorcycle.name, "title": r.title, "is_active": r.is_active})


def documents(request):
    token, error = _require_token(request, "documents:read")
    if error:
        return error
    qs = MotorcycleDocument.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True).select_related("motorcycle")
    return _page(request, qs, lambda d: {"id": d.pk, "motorcycle": d.motorcycle.name, "name": d.name, "document_type": d.document_type})


def expenses(request):
    token, error = _require_token(request, "expenses:read")
    if error:
        return error
    fees = [
        {"id": f"fee-{fee.pk}", "motorcycle": fee.motorcycle.name, "kind": "annual_fee", "title": fee.get_fee_type_display(), "amount": str(fee.amount)}
        for fee in AnnualFee.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True).select_related("motorcycle")
    ]
    policies = [
        {"id": f"policy-{policy.pk}", "motorcycle": policy.motorcycle.name, "kind": "insurance", "title": policy.provider, "amount": str(policy.premium)}
        for policy in InsurancePolicy.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True).select_related("motorcycle")
    ]
    rows = fees + policies
    return JsonResponse({"count": len(rows), "limit": len(rows), "offset": 0, "results": rows})
