from __future__ import annotations

import time

from django.contrib.auth.hashers import check_password
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone

from apps.core.models import ApiToken
from apps.documents.models import MotorcycleDocument
from apps.expenses.models import AnnualFee, InsurancePolicy
from apps.fuel.models import FuelRecord
from apps.maintenance.models import MaintenanceRecord
from apps.reminders.models import Reminder
from apps.tires.models import TireRecord

# B-M12: token-bucket-ish rate limiting per API token. 60 requests / minute is
# generous enough for normal integrations but cheap enough that a runaway
# script cannot hammer the DB. Implemented in cache so we don't pay a DB write
# per request; tolerates the cache resetting (worst case: a window of bursts).
_RATE_LIMIT_PER_MINUTE = 60
_RATE_WINDOW_SECONDS = 60


def _rate_limited(token: ApiToken) -> bool:
    window = int(time.time() // _RATE_WINDOW_SECONDS)
    key = f"api:rate:{token.pk}:{window}"
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, _RATE_WINDOW_SECONDS)
        count = 1
    return count > _RATE_LIMIT_PER_MINUTE


def _token_from_request(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Token "):
        return None
    raw_key = auth.removeprefix("Token ").strip()
    prefix = raw_key[:12] if len(raw_key) >= 12 else raw_key
    for token in ApiToken.objects.filter(is_active=True, key_prefix=prefix).select_related("owner"):
        if check_password(raw_key, token.key_hash):
            ApiToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())
            return token
    return None


def _require_token(request, scope: str):
    token = _token_from_request(request)
    if not token:
        return None, JsonResponse({"detail": "Token ausente ou inválido."}, status=401)
    if not token.has_scope(scope):
        return None, JsonResponse({"detail": "Token sem permissão para este recurso."}, status=403)
    if _rate_limited(token):
        response = JsonResponse(
            {"detail": f"Limite de {_RATE_LIMIT_PER_MINUTE} requisições por minuto excedido."},
            status=429,
        )
        response["Retry-After"] = str(_RATE_WINDOW_SECONDS)
        return None, response
    return token, None


def _pagination_params(request):
    try:
        limit = int(request.GET.get("limit", 50) or 50)
        offset = int(request.GET.get("offset", 0) or 0)
    except (TypeError, ValueError):
        return None, JsonResponse({"detail": "Parametros de paginacao invalidos."}, status=400)
    return (min(max(limit, 1), 100), max(offset, 0)), None


def _page(request, qs, serializer):
    params, error = _pagination_params(request)
    if error:
        return error
    limit, offset = params
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
    params, pagination_error = _pagination_params(request)
    if pagination_error:
        return pagination_error
    limit, offset = params

    fees_qs = AnnualFee.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True)
    policies_qs = InsurancePolicy.objects.filter(motorcycle__owner=token.owner, motorcycle__is_active=True)

    # Build ordered meta-lists so we can merge by date safely even if rows are deleted between pages.
    fee_meta = list(fees_qs.order_by("-due_date", "pk").values("pk", "due_date"))
    policy_meta = list(policies_qs.order_by("-coverage_end", "pk").values("pk", "coverage_end"))

    merged = []
    for f in fee_meta:
        merged.append({"kind": "fee", "pk": f["pk"], "date": f["due_date"]})
    for p in policy_meta:
        merged.append({"kind": "policy", "pk": p["pk"], "date": p["coverage_end"]})
    merged.sort(key=lambda r: (r["date"], r["pk"]), reverse=True)

    total = len(merged)
    page = merged[offset : offset + limit]
    fee_pks = [m["pk"] for m in page if m["kind"] == "fee"]
    policy_pks = [m["pk"] for m in page if m["kind"] == "policy"]

    fees_map = {
        f.pk: f
        for f in fees_qs.filter(pk__in=fee_pks).select_related("motorcycle")
    }
    policies_map = {
        p.pk: p
        for p in policies_qs.filter(pk__in=policy_pks).select_related("motorcycle")
    }

    rows = []
    for m in page:
        if m["kind"] == "fee":
            fee = fees_map[m["pk"]]
            rows.append(
                {
                    "id": f"fee-{fee.pk}",
                    "motorcycle": fee.motorcycle.name,
                    "kind": "annual_fee",
                    "title": fee.get_fee_type_display(),
                    "amount": str(fee.amount),
                }
            )
        else:
            policy = policies_map[m["pk"]]
            rows.append(
                {
                    "id": f"policy-{policy.pk}",
                    "motorcycle": policy.motorcycle.name,
                    "kind": "insurance",
                    "title": policy.provider,
                    "amount": str(policy.premium),
                }
            )

    return JsonResponse({"count": total, "limit": limit, "offset": offset, "results": rows})
