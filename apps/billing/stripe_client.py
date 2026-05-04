from __future__ import annotations

from django.conf import settings
from django.urls import reverse

from .entitlements import ensure_subscription_profile

try:
    import stripe
    from stripe._error import SignatureVerificationError, StripeError
except ImportError:
    stripe = None

    class StripeError(Exception):
        pass

    class SignatureVerificationError(StripeError):
        pass


class BillingConfigurationError(RuntimeError):
    pass


def get_stripe_client():
    if stripe is None:
        raise BillingConfigurationError("Instale a dependencia stripe para usar cobrancas.")
    if not settings.STRIPE_SECRET_KEY:
        raise BillingConfigurationError("STRIPE_SECRET_KEY nao configurada.")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    stripe.api_version = settings.STRIPE_API_VERSION
    return stripe


def construct_webhook_event(payload: bytes, signature: str):
    if stripe is None:
        raise BillingConfigurationError("Instale a dependencia stripe para usar cobrancas.")
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise BillingConfigurationError("STRIPE_WEBHOOK_SECRET nao configurada.")
    stripe.api_version = settings.STRIPE_API_VERSION
    return stripe.Webhook.construct_event(payload, signature, settings.STRIPE_WEBHOOK_SECRET)


def pro_price_id(interval: str) -> str:
    if interval == "yearly":
        price_id = settings.STRIPE_PRO_YEARLY_PRICE_ID
    else:
        price_id = settings.STRIPE_PRO_MONTHLY_PRICE_ID
    if not price_id:
        raise BillingConfigurationError("Configure os Price IDs do Plano Pro no ambiente.")
    return price_id


def create_checkout_session(*, request, interval: str = "monthly"):
    interval = "yearly" if interval == "yearly" else "monthly"
    profile = ensure_subscription_profile(request.user)
    stripe = get_stripe_client()
    success_url = request.build_absolute_uri(f"{reverse('billing:account')}?checkout=success")
    cancel_url = request.build_absolute_uri(f"{reverse('pricing')}?checkout=cancelled")
    payload = {
        "mode": "subscription",
        "line_items": [{"price": pro_price_id(interval), "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": str(request.user.pk),
        "customer_email": request.user.email or None,
        "locale": "pt-BR",
        "payment_method_types": settings.STRIPE_PAYMENT_METHOD_TYPES,
        "allow_promotion_codes": True,
        "metadata": {"user_id": str(request.user.pk), "plan": "pro", "interval": interval},
        "subscription_data": {"metadata": {"user_id": str(request.user.pk), "plan": "pro", "interval": interval}},
    }
    if profile.stripe_customer_id:
        payload["customer"] = profile.stripe_customer_id
        payload.pop("customer_email", None)
    return stripe.checkout.Session.create(**payload)


def create_portal_session(*, request):
    profile = ensure_subscription_profile(request.user)
    if not profile.stripe_customer_id:
        raise BillingConfigurationError("Nenhum cliente Stripe vinculado a esta conta.")
    stripe = get_stripe_client()
    return stripe.billing_portal.Session.create(
        customer=profile.stripe_customer_id,
        return_url=request.build_absolute_uri(reverse("billing:account")),
    )
