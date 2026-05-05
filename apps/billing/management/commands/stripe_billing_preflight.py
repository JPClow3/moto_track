from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.billing.stripe_client import BillingConfigurationError, get_stripe_client, pro_price_id


class Command(BaseCommand):
    help = "Validate Stripe Pro subscription Checkout configuration, including configured payment methods."

    def handle(self, *args, **options):
        try:
            stripe = get_stripe_client()
            session = stripe.checkout.Session.create(
                mode="subscription",
                line_items=[{"price": pro_price_id("monthly"), "quantity": 1}],
                success_url="https://moto-track.net/billing/preflight/success",
                cancel_url="https://moto-track.net/billing/preflight/cancel",
                payment_method_types=settings.STRIPE_PAYMENT_METHOD_TYPES,
                metadata={"preflight": "true"},
            )
            stripe.checkout.Session.expire(session.id)
        except BillingConfigurationError as exc:
            raise CommandError(str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise CommandError(
                "Stripe rejeitou a configuracao de assinatura. Verifique Pix/cartao, Price IDs e conta Stripe."
            ) from exc
        self.stdout.write(self.style.SUCCESS("Stripe billing preflight OK."))
