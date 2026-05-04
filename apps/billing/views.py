from __future__ import annotations

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .entitlements import get_subscription_profile, has_pro_access, plan_label, remaining_upload_slots
from .models import AccountDataRequest
from .stripe_client import (
    BillingConfigurationError,
    SignatureVerificationError,
    StripeError,
    construct_webhook_event,
    create_checkout_session,
    create_portal_session,
)
from .webhooks import WebhookProcessingError, process_stripe_event


def pricing_view(request):
    return render(
        request,
        "billing/pricing.html",
        {
            "monthly_price": "14,90",
            "yearly_price": "129",
            "has_pro": has_pro_access(request.user) if request.user.is_authenticated else False,
        },
    )


@login_required
def billing_account_view(request):
    profile = get_subscription_profile(request.user)
    return render(
        request,
        "billing/account.html",
        {
            "profile": profile,
            "plan_label": plan_label(request.user),
            "has_pro": has_pro_access(request.user),
            "remaining_upload_slots": remaining_upload_slots(request.user),
            "data_requests": request.user.data_requests.all()[:5],
        },
    )


@login_required
@require_POST
def checkout_view(request):
    interval = request.POST.get("interval") or request.GET.get("interval") or "monthly"
    try:
        session = create_checkout_session(request=request, interval=interval)
    except BillingConfigurationError as exc:
        messages.error(request, str(exc))
        return redirect("pricing")
    return redirect(session.url)


@login_required
@require_POST
def portal_view(request):
    try:
        session = create_portal_session(request=request)
    except BillingConfigurationError as exc:
        messages.error(request, str(exc))
        return redirect("billing:account")
    return redirect(session.url)


@login_required
def data_export_view(request):
    motorcycles = []
    for motorcycle in request.user.motorcycles.all().order_by("name"):
        motorcycles.append(
            {
                "name": motorcycle.name,
                "brand": motorcycle.brand,
                "model": motorcycle.model,
                "year": motorcycle.year,
                "current_odometer_km": motorcycle.current_odometer_km,
                "fuel_records": motorcycle.fuel_records.count(),
                "maintenance_records": motorcycle.maintenance_records.count(),
                "documents": motorcycle.documents.count(),
            }
        )
    AccountDataRequest.objects.create(user=request.user, request_type=AccountDataRequest.RequestType.EXPORT)
    response = JsonResponse(
        {
            "user": {"username": request.user.username, "email": request.user.email},
            "plan": plan_label(request.user),
            "motorcycles": motorcycles,
        },
        json_dumps_params={"ensure_ascii": False, "indent": 2},
    )
    response["Content-Disposition"] = 'attachment; filename="moto_track_dados.json"'
    return response


@login_required
@require_POST
def data_deletion_request_view(request):
    AccountDataRequest.objects.create(user=request.user, request_type=AccountDataRequest.RequestType.DELETION)
    messages.success(request, "Solicitacao de exclusao registrada. O suporte vai revisar antes de qualquer remocao.")
    return redirect("billing:account")


@csrf_exempt
@require_POST
def stripe_webhook_view(request):
    payload = request.body
    signature = request.headers.get("Stripe-Signature", "")
    try:
        event = construct_webhook_event(payload, signature)
    except BillingConfigurationError:
        return HttpResponse("Webhook endpoint is not configured.", status=503)
    except (ValueError, SignatureVerificationError, StripeError):
        return HttpResponse("Invalid webhook payload.", status=400)

    try:
        process_stripe_event(event)
    except WebhookProcessingError:
        return HttpResponse("Invalid webhook payload.", status=400)
    return HttpResponse(status=200)
