from django.apps import AppConfig


class FuelConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.fuel"

    def ready(self):  # noqa: D401
        from . import signals  # noqa: F401
