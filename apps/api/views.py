from __future__ import annotations

import time

from django.core.cache import cache
from rest_framework import throttling
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.api.authentication import ApiTokenAuthentication, HasApiScope
from apps.api.serializers import (
    ExpenseSerializer,
    FuelRecordSerializer,
    MaintenanceRecordSerializer,
    MotorcycleDocumentSerializer,
    ReminderSerializer,
    TireRecordSerializer,
)
from apps.documents.models import MotorcycleDocument
from apps.expenses.models import AnnualFee, InsurancePolicy
from apps.fuel.models import FuelRecord
from apps.maintenance.models import MaintenanceRecord
from apps.reminders.models import Reminder
from apps.tires.models import TireRecord


class JsonOnlyContentNegotiation(BaseContentNegotiation):
    def select_parser(self, request, parsers):  # noqa: ARG002
        return parsers[0] if parsers else None

    def select_renderer(self, request, renderers, format_suffix=None):  # noqa: ARG002
        renderer = renderers[0]
        return renderer, renderer.media_type


class ApiTokenThrottle(throttling.BaseThrottle):
    """Per-ApiToken rate limit, ~60 requests / minute (B-M12).

    Keyed on the authenticating token's pk rather than the user, so multiple
    tokens belonging to the same user have independent budgets. Uses a
    fixed-window counter in cache — cheap enough not to need a per-request DB
    write, with the well-known trade-off of allowing a small burst at the
    window boundary. Acceptable for our threat model (runaway script
    protection, not abuse prevention).
    """

    rate_limit_per_minute = 60
    window_seconds = 60

    def allow_request(self, request, view):
        token = getattr(request, "auth", None)
        if token is None or getattr(token, "pk", None) is None:
            # No token => upstream auth will reject; don't double-deny here.
            return True
        window = int(time.time() // self.window_seconds)
        cache_key = f"api:rate:{token.pk}:{window}"
        try:
            count = cache.incr(cache_key)
        except ValueError:
            cache.set(cache_key, 1, self.window_seconds)
            count = 1
        return count <= self.rate_limit_per_minute

    def wait(self):
        return self.window_seconds


class ScopedApiView(APIView):
    authentication_classes = [ApiTokenAuthentication]
    permission_classes = [HasApiScope]
    throttle_classes = [ApiTokenThrottle]
    renderer_classes = [JSONRenderer]
    content_negotiation_class = JsonOnlyContentNegotiation
    required_scope = ""


def _pagination_params(request):
    try:
        limit = int(request.query_params.get("limit", 50) or 50)
        offset = int(request.query_params.get("offset", 0) or 0)
    except (TypeError, ValueError):
        return None, Response({"detail": "Parametros de paginacao invalidos."}, status=400)
    return (min(max(limit, 1), 100), max(offset, 0)), None


def _page(request, qs, serializer_class):
    params, error = _pagination_params(request)
    if error:
        return error
    limit, offset = params
    total = qs.count()
    serializer = serializer_class(qs[offset : offset + limit], many=True)
    return Response({"count": total, "limit": limit, "offset": offset, "results": serializer.data})


class FuelRecordsView(ScopedApiView):
    required_scope = "fuel:read"

    def get(self, request):
        qs = FuelRecord.objects.filter(
            motorcycle__owner=request.user,
            motorcycle__is_active=True,
        ).select_related("motorcycle", "station")
        return _page(request, qs, FuelRecordSerializer)


class MaintenanceRecordsView(ScopedApiView):
    required_scope = "maintenance:read"

    def get(self, request):
        qs = MaintenanceRecord.objects.filter(
            motorcycle__owner=request.user,
            motorcycle__is_active=True,
        ).select_related("motorcycle")
        return _page(request, qs, MaintenanceRecordSerializer)


class TireRecordsView(ScopedApiView):
    required_scope = "tires:read"

    def get(self, request):
        qs = TireRecord.objects.filter(
            motorcycle__owner=request.user,
            motorcycle__is_active=True,
        ).select_related("motorcycle")
        return _page(request, qs, TireRecordSerializer)


class RemindersView(ScopedApiView):
    required_scope = "reminders:read"

    def get(self, request):
        qs = Reminder.objects.filter(
            motorcycle__owner=request.user,
            motorcycle__is_active=True,
        ).select_related("motorcycle")
        return _page(request, qs, ReminderSerializer)


class DocumentsView(ScopedApiView):
    required_scope = "documents:read"

    def get(self, request):
        qs = MotorcycleDocument.objects.filter(
            motorcycle__owner=request.user,
            motorcycle__is_active=True,
        ).select_related("motorcycle")
        return _page(request, qs, MotorcycleDocumentSerializer)


class ExpensesView(ScopedApiView):
    required_scope = "expenses:read"

    def get(self, request):
        params, pagination_error = _pagination_params(request)
        if pagination_error:
            return pagination_error
        limit, offset = params

        fees_qs = AnnualFee.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)
        policies_qs = InsurancePolicy.objects.filter(motorcycle__owner=request.user, motorcycle__is_active=True)

        fee_meta = list(fees_qs.order_by("-due_date", "pk").values("pk", "due_date"))
        policy_meta = list(policies_qs.order_by("-coverage_end", "pk").values("pk", "coverage_end"))

        merged = [{"kind": "fee", "pk": fee["pk"], "date": fee["due_date"]} for fee in fee_meta]
        merged.extend(
            {"kind": "policy", "pk": policy["pk"], "date": policy["coverage_end"]}
            for policy in policy_meta
        )
        merged.sort(key=lambda row: (row["date"], row["pk"]), reverse=True)

        total = len(merged)
        page = merged[offset : offset + limit]
        fee_pks = [item["pk"] for item in page if item["kind"] == "fee"]
        policy_pks = [item["pk"] for item in page if item["kind"] == "policy"]

        fees_map = {
            fee.pk: fee
            for fee in fees_qs.filter(pk__in=fee_pks).select_related("motorcycle")
        }
        policies_map = {
            policy.pk: policy
            for policy in policies_qs.filter(pk__in=policy_pks).select_related("motorcycle")
        }

        rows = []
        for item in page:
            obj = fees_map.get(item["pk"]) if item["kind"] == "fee" else policies_map.get(item["pk"])
            if obj:
                rows.append({"kind": item["kind"], "object": obj})

        serializer = ExpenseSerializer(rows, many=True)
        return Response({"count": total, "limit": limit, "offset": offset, "results": serializer.data})
