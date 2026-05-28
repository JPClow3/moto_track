from __future__ import annotations

import logging

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit

from .entitlements import (
    ensure_subscription_profile,
    get_subscription_profile,
    has_pro_access,
    is_admin_entitled,
    plan_label,
    remaining_upload_slots,
)
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

logger = logging.getLogger(__name__)

# Stripe webhook payloads are typically <50 KB. 1 MB is a generous safety cap
# that rejects oversized abuse without ever clipping a real Stripe event.
STRIPE_WEBHOOK_MAX_BODY_BYTES = 1_048_576


def _iso(value):
    return value.isoformat() if value else None


def _money(value):
    if value is None:
        return None
    amount = getattr(value, "amount", value)
    currency = getattr(value, "currency", None)
    return {"amount": str(amount), "currency": str(currency or "")}


def _file_metadata(field):
    name = getattr(field, "name", "") or ""
    if not name:
        return None
    try:
        url = field.url
    except Exception:
        url = ""
    try:
        size = field.size
    except Exception:
        size = None
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return {"name": name, "type": extension, "url": url, "size": size}


def _model_timestamps(obj):
    return {"created_at": _iso(getattr(obj, "created_at", None)), "updated_at": _iso(getattr(obj, "updated_at", None))}


def _motorcycle_spec(spec):
    if not spec:
        return None
    return {
        "fuel_tank_capacity_l": str(spec.fuel_tank_capacity_l) if spec.fuel_tank_capacity_l is not None else None,
        "fuel_type_recommendation": spec.fuel_type_recommendation,
        "fuel_octane_min": spec.fuel_octane_min,
        "oil_capacity_l": str(spec.oil_capacity_l) if spec.oil_capacity_l is not None else None,
        "tire_size_front": spec.tire_size_front,
        "tire_size_rear": spec.tire_size_rear,
        "tire_speed_rating": spec.tire_speed_rating,
        "battery_spec": spec.battery_spec,
        "chain_size": spec.chain_size,
        "recommended_tire_pressure_front": spec.recommended_tire_pressure_front,
        "recommended_tire_pressure_rear": spec.recommended_tire_pressure_rear,
        "oil_type_recommendation": spec.oil_type_recommendation,
        "oil_viscosity_recommendation": spec.oil_viscosity_recommendation,
        "manual_reference": spec.manual_reference,
        "consumption_avg_km_l": str(spec.consumption_avg_km_l) if spec.consumption_avg_km_l is not None else None,
        **_model_timestamps(spec),
    }


def _build_account_export(user) -> dict:
    from apps.documents.models import MotorcycleDocument
    from apps.expenses.models import AnnualFee, InsurancePolicy
    from apps.fuel.models import FuelGrade, FuelPreference, FuelRecord, FuelReviewPreference, FuelStation
    from apps.maintenance.models import MaintenancePart, MaintenancePlanItem, MaintenanceRecord
    from apps.reminders.models import Reminder
    from apps.tires.models import TirePressureRecord, TireProduct, TireRecord
    from apps.work.models import ProfessionalCostSettings, WorkSession

    motorcycles = []
    for motorcycle in user.motorcycles.select_related("spec", "fuel_review_preference").all().order_by("name"):
        maintenance_records = []
        for record in (
            MaintenanceRecord.objects.filter(motorcycle=motorcycle)
            .prefetch_related("maintenancerecordpart_set__part", "photos")
            .order_by("-date", "-odometer_km")
        ):
            maintenance_records.append(
                {
                    "id": record.pk,
                    "maintenance_type": record.maintenance_type,
                    "date": _iso(record.date),
                    "odometer_km": record.odometer_km,
                    "description": record.description,
                    "parts_used": record.parts_used,
                    "cost": _money(record.cost),
                    "workshop": record.workshop,
                    "interval_km": record.interval_km,
                    "interval_days": record.interval_days,
                    "parts": [
                        {
                            "part_id": row.part_id,
                            "name": row.part.name,
                            "quantity": row.quantity,
                            "unit_price": _money(row.unit_price),
                        }
                        for row in record.maintenancerecordpart_set.all()
                    ],
                    "photos": [
                        {
                            "id": photo.pk,
                            "caption": photo.caption,
                            "order": photo.order,
                            "file": _file_metadata(photo.image),
                            **_model_timestamps(photo),
                        }
                        for photo in record.photos.all()
                    ],
                    **_model_timestamps(record),
                }
            )

        insurance_policies = []
        for policy in InsurancePolicy.objects.filter(motorcycle=motorcycle).prefetch_related("claims").order_by("-coverage_end"):
            insurance_policies.append(
                {
                    "id": policy.pk,
                    "provider": policy.provider,
                    "policy_number": policy.policy_number,
                    "coverage_start": _iso(policy.coverage_start),
                    "coverage_end": _iso(policy.coverage_end),
                    "premium": _money(policy.premium),
                    "notify_before_days": policy.notify_before_days,
                    "notes": policy.notes,
                    "claims": [
                        {
                            "id": claim.pk,
                            "claim_date": _iso(claim.claim_date),
                            "description": claim.description,
                            "amount": _money(claim.amount),
                            "status": claim.status,
                            **_model_timestamps(claim),
                        }
                        for claim in policy.claims.all()
                    ],
                    **_model_timestamps(policy),
                }
            )

        cost_settings = ProfessionalCostSettings.objects.filter(motorcycle=motorcycle).first()
        fuel_review_preference = FuelReviewPreference.objects.filter(motorcycle=motorcycle).first()
        motorcycles.append(
            {
                "id": motorcycle.pk,
                "name": motorcycle.name,
                "brand": motorcycle.brand,
                "model": motorcycle.model,
                "year": motorcycle.year,
                "license_plate": motorcycle.license_plate,
                "is_active": motorcycle.is_active,
                "deleted_at": _iso(motorcycle.deleted_at),
                "current_odometer_km": motorcycle.current_odometer_km,
                "current_odometer_updated_at": _iso(motorcycle.current_odometer_updated_at),
                "odometer_override_km": motorcycle.odometer_override_km,
                "odometer_override_at": _iso(motorcycle.odometer_override_at),
                "previous_owners": motorcycle.previous_owners,
                "riding_profile": motorcycle.riding_profile,
                "purchase_price": _money(motorcycle.purchase_price),
                "purchase_date": _iso(motorcycle.purchase_date),
                "observations": motorcycle.observations,
                "photo": _file_metadata(motorcycle.photo),
                "spec": _motorcycle_spec(getattr(motorcycle, "spec", None)),
                "fuel_review_preference": (
                    {
                        "fillups_interval": fuel_review_preference.fillups_interval,
                        "is_active": fuel_review_preference.is_active,
                        **_model_timestamps(fuel_review_preference),
                    }
                    if fuel_review_preference
                    else None
                ),
                "fuel_records": [
                    {
                        "id": record.pk,
                        "date": _iso(record.date),
                        "odometer_km": record.odometer_km,
                        "liters": str(record.liters),
                        "total_price": _money(record.total_price),
                        "price_per_liter": _money(record.price_per_liter),
                        "fuel_type": record.fuel_type,
                        "tank_full": record.tank_full,
                        "station_id": record.station_id,
                        "station_name": record.station_name,
                        "fuel_grade_id": record.fuel_grade_id,
                        "notes": record.notes,
                        "receipt_file": _file_metadata(record.receipt_file),
                        **_model_timestamps(record),
                    }
                    for record in FuelRecord.objects.filter(motorcycle=motorcycle).order_by("-date", "-odometer_km")
                ],
                "maintenance_records": maintenance_records,
                "maintenance_plan_items": [
                    {
                        "id": item.pk,
                        "maintenance_type": item.maintenance_type,
                        "interval_km": item.interval_km,
                        "interval_days": item.interval_days,
                        "last_done_km": item.last_done_km,
                        "last_done_date": _iso(item.last_done_date),
                        "is_severe_duty_override": item.is_severe_duty_override,
                        "notes": item.notes,
                        "is_active": item.is_active,
                        **_model_timestamps(item),
                    }
                    for item in MaintenancePlanItem.objects.filter(motorcycle=motorcycle).order_by("maintenance_type")
                ],
                "tires": [
                    {
                        "id": tire.pk,
                        "tire_product_id": tire.tire_product_id,
                        "position": tire.position,
                        "brand_model": tire.brand_model,
                        "installed_at": _iso(tire.installed_at),
                        "installed_odometer_km": tire.installed_odometer_km,
                        "cost": _money(tire.cost),
                        "purchase_price": _money(tire.purchase_price),
                        "recommended_pressure": tire.recommended_pressure,
                        "wear_percent": tire.wear_percent,
                        "estimated_change_km": tire.estimated_change_km,
                        "is_active": tire.is_active,
                        **_model_timestamps(tire),
                    }
                    for tire in TireRecord.objects.filter(motorcycle=motorcycle).order_by("-installed_at")
                ],
                "tire_pressure_records": [
                    {
                        "id": pressure.pk,
                        "date": _iso(pressure.date),
                        "psi_front": pressure.psi_front,
                        "psi_rear": pressure.psi_rear,
                        "notes": pressure.notes,
                        **_model_timestamps(pressure),
                    }
                    for pressure in TirePressureRecord.objects.filter(motorcycle=motorcycle).order_by("-date")
                ],
                "documents": [
                    {
                        "id": document.pk,
                        "name": document.name,
                        "document_type": document.document_type,
                        "valid_until": _iso(document.valid_until),
                        "notify_before_days": document.notify_before_days,
                        "notes": document.notes,
                        "file": _file_metadata(document.file),
                        **_model_timestamps(document),
                    }
                    for document in MotorcycleDocument.objects.filter(motorcycle=motorcycle).order_by("name")
                ],
                "reminders": [
                    {
                        "id": reminder.pk,
                        "title": reminder.title,
                        "description": reminder.description,
                        "trigger_type": reminder.trigger_type,
                        "trigger_value_km": reminder.trigger_value_km,
                        "trigger_value_days": reminder.trigger_value_days,
                        "reference_km": reminder.reference_km,
                        "reference_date": _iso(reminder.reference_date),
                        "is_active": reminder.is_active,
                        "send_email": reminder.send_email,
                        "send_push": reminder.send_push,
                        "last_notified_at": _iso(reminder.last_notified_at),
                        "last_email_notified_at": _iso(reminder.last_email_notified_at),
                        "last_push_notified_at": _iso(reminder.last_push_notified_at),
                        "notes": reminder.notes,
                        **_model_timestamps(reminder),
                    }
                    for reminder in Reminder.objects.filter(motorcycle=motorcycle).order_by("title")
                ],
                "annual_fees": [
                    {
                        "id": fee.pk,
                        "fee_type": fee.fee_type,
                        "year": fee.year,
                        "due_date": _iso(fee.due_date),
                        "paid_date": _iso(fee.paid_date),
                        "amount": _money(fee.amount),
                        "notify_before_days": fee.notify_before_days,
                        "notes": fee.notes,
                        **_model_timestamps(fee),
                    }
                    for fee in AnnualFee.objects.filter(motorcycle=motorcycle).order_by("-due_date")
                ],
                "insurance_policies": insurance_policies,
                "work_sessions": [
                    {
                        "id": session.pk,
                        "work_date": _iso(session.work_date),
                        "started_at": _iso(session.started_at),
                        "ended_at": _iso(session.ended_at),
                        "odometer_start_km": session.odometer_start_km,
                        "odometer_end_km": session.odometer_end_km,
                        "gross_income": str(session.gross_income),
                        "tips": str(session.tips),
                        "fuel_spent": str(session.fuel_spent) if session.fuel_spent is not None else None,
                        "deliveries_count": session.deliveries_count,
                        "platform_source": session.platform_source,
                        "payment_method": session.payment_method,
                        "notes": session.notes,
                        **_model_timestamps(session),
                    }
                    for session in WorkSession.objects.filter(motorcycle=motorcycle, owner=user).order_by("-work_date")
                ],
                "professional_cost_settings": (
                    {
                        "maintenance_reserve_per_km": str(cost_settings.maintenance_reserve_per_km),
                        "depreciation_per_km": str(cost_settings.depreciation_per_km),
                        "fixed_daily_cost": str(cost_settings.fixed_daily_cost),
                        **_model_timestamps(cost_settings),
                    }
                    if cost_settings
                    else None
                ),
                **_model_timestamps(motorcycle),
            }
        )

    profile = get_subscription_profile(user)
    return {
        "exported_at": _iso(timezone.now()),
        "user": {
            "id": user.pk,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "date_joined": _iso(user.date_joined),
            "last_login": _iso(user.last_login),
        },
        "plan": plan_label(user),
        "billing_profile": (
            {
                "plan": profile.plan,
                "billing_interval": profile.billing_interval,
                "stripe_customer_id": profile.stripe_customer_id,
                "stripe_subscription_id": profile.stripe_subscription_id,
                "stripe_subscription_status": profile.stripe_subscription_status,
                "stripe_price_id": profile.stripe_price_id,
                "current_period_end": _iso(profile.current_period_end),
                "cancel_at_period_end": profile.cancel_at_period_end,
                "grace_until": _iso(profile.grace_until),
                "latest_invoice_url": profile.latest_invoice_url,
                "latest_receipt_url": profile.latest_receipt_url,
                "next_invoice_at": _iso(profile.next_invoice_at),
                "next_invoice_amount_cents": profile.next_invoice_amount_cents,
                "next_invoice_currency": profile.next_invoice_currency,
                **_model_timestamps(profile),
            }
            if profile
            else None
        ),
        "motorcycles": motorcycles,
        "catalogs": {
            "fuel_stations": [
                {
                    "id": station.pk,
                    "name": station.name,
                    "brand": station.brand,
                    "city": station.city,
                    "state": station.state,
                    "notes": station.notes,
                    **_model_timestamps(station),
                }
                for station in FuelStation.objects.filter(owner=user).order_by("name")
            ],
            "fuel_grades": [
                {
                    "id": grade.pk,
                    "name": grade.name,
                    "fuel_type": grade.fuel_type,
                    "octane_rating": grade.octane_rating,
                    "ethanol_percentage": str(grade.ethanol_percentage) if grade.ethanol_percentage is not None else None,
                    "default_price_per_liter": _money(grade.default_price_per_liter),
                    "notes": grade.notes,
                    **_model_timestamps(grade),
                }
                for grade in FuelGrade.objects.filter(owner=user).order_by("name")
            ],
            "fuel_preferences": [
                {
                    "id": preference.pk,
                    "motorcycle_id": preference.motorcycle_id,
                    "station_id": preference.station_id,
                    "fuel_grade_id": preference.fuel_grade_id,
                    "fuel_type": preference.fuel_type,
                    "station_name": preference.station_name,
                    "price_per_liter": _money(preference.price_per_liter),
                    "tank_full": preference.tank_full,
                    "use_count": preference.use_count,
                    "last_used_at": _iso(preference.last_used_at),
                    **_model_timestamps(preference),
                }
                for preference in FuelPreference.objects.filter(owner=user).order_by("-last_used_at", "-use_count")
            ],
            "maintenance_parts": [
                {
                    "id": part.pk,
                    "name": part.name,
                    "manufacturer": part.manufacturer,
                    "part_type": part.part_type,
                    "sku": part.sku,
                    "price": _money(part.price),
                    "track_stock": part.track_stock,
                    "stock_quantity": part.stock_quantity,
                    "low_stock_threshold": part.low_stock_threshold,
                    "notes": part.notes,
                    **_model_timestamps(part),
                }
                for part in MaintenancePart.objects.filter(owner=user).order_by("name")
            ],
            "tire_products": [
                {
                    "id": product.pk,
                    "manufacturer": product.manufacturer,
                    "model_name": product.model_name,
                    "tire_type": product.tire_type,
                    "width_mm": product.width_mm,
                    "aspect_ratio": product.aspect_ratio,
                    "rim_diameter_in": product.rim_diameter_in,
                    "load_index": product.load_index,
                    "speed_rating": product.speed_rating,
                    "max_speed_kmh": product.max_speed_kmh,
                    "price": _money(product.price),
                    "image": _file_metadata(product.image),
                    "notes": product.notes,
                    **_model_timestamps(product),
                }
                for product in TireProduct.objects.filter(owner=user).order_by("manufacturer", "model_name")
            ],
        },
        "data_requests": [
            {
                "id": request_obj.pk,
                "request_type": request_obj.request_type,
                "status": request_obj.status,
                "notes": request_obj.notes,
                "fulfilled_at": _iso(request_obj.fulfilled_at),
                **_model_timestamps(request_obj),
            }
            for request_obj in user.data_requests.all().order_by("-created_at")
        ],
        "api_tokens": [
            {
                "id": token.pk,
                "name": token.name,
                "key_prefix": token.key_prefix,
                "scopes": token.scopes,
                "is_active": token.is_active,
                "last_used_at": _iso(token.last_used_at),
                **_model_timestamps(token),
            }
            for token in user.api_tokens.all().order_by("name")
        ],
    }


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
    profile = (
        ensure_subscription_profile(request.user)
        if is_admin_entitled(request.user)
        else get_subscription_profile(request.user)
    )
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
    if has_pro_access(request.user):
        messages.info(request, "Seu Plano Pro ja esta ativo.")
        return redirect("billing:account")
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
    # Only persist the LGPD audit record on POST so browser prefetch / scanner
    # traffic can't proliferate AccountDataRequest rows. The download UI uses a
    # CSRF-protected POST form (templates/billing/account.html) to record the
    # event; GET still serves the file for direct downloads but stays
    # side-effect-free.
    if request.method == "POST":
        AccountDataRequest.objects.create(
            user=request.user,
            request_type=AccountDataRequest.RequestType.EXPORT,
            status=AccountDataRequest.Status.DONE,
            fulfilled_at=timezone.now(),
        )
    response = JsonResponse(_build_account_export(request.user), json_dumps_params={"ensure_ascii": False, "indent": 2})
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
@ratelimit(key="ip", rate="120/m", block=True)
def stripe_webhook_view(request):
    payload = request.body
    if len(payload) > STRIPE_WEBHOOK_MAX_BODY_BYTES:
        return HttpResponse("Payload too large.", status=413)
    signature = request.headers.get("Stripe-Signature", "")
    try:
        event = construct_webhook_event(payload, signature)
    except BillingConfigurationError:
        return HttpResponse("Webhook endpoint is not configured.", status=503)
    except (ValueError, SignatureVerificationError, StripeError):
        return HttpResponse("Invalid webhook payload.", status=400)

    try:
        process_stripe_event(event)
    except WebhookProcessingError as exc:
        # Return 5xx so Stripe retries with backoff. The event is still
        # recorded on BillingEvent.processing_error for triage. Sentry
        # capture surfaces the failure to oncall via the Django integration.
        logger.exception("Stripe webhook processing failed", extra={"event_type": event.get("type")})
        try:
            import sentry_sdk

            sentry_sdk.capture_exception(exc)
        except ImportError:
            pass
        return HttpResponse("Webhook processing failed.", status=500)
    return HttpResponse(status=200)
