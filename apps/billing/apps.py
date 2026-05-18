from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.billing"
    verbose_name = "Billing"

    def ready(self):
        # Wire up Pro-access cache invalidation on SubscriptionProfile changes.
        from . import signals  # noqa: F401
