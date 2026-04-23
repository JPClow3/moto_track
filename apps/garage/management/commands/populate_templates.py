from django.core.management.base import BaseCommand
from django.db import transaction

from apps.garage.catalog_seed import seed_motorcycle_templates
from apps.garage.models import (
    MotorcycleTemplate,
    MotorcycleTemplateMaintenanceInterval,
    MotorcycleTemplateSpec,
)


class Command(BaseCommand):
    help = "Populate motorcycle template ranges with generation-specific data."

    @transaction.atomic
    def handle(self, *args, **options):
        count = seed_motorcycle_templates(
            MotorcycleTemplate,
            MotorcycleTemplateSpec,
            MotorcycleTemplateMaintenanceInterval,
        )
        self.stdout.write(self.style.SUCCESS(f"Successfully populated {count} template ranges."))
