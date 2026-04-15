from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.garage.models import Motorcycle
from apps.garage.services import recompute_motorcycle_odometer


class Command(BaseCommand):
    help = "Recompute and persist current odometer for all motorcycles."

    def handle(self, *args, **options):  # noqa: ARG002
        updated = 0
        for moto in Motorcycle.objects.all().only("id"):
            recompute_motorcycle_odometer(moto.id)
            updated += 1
        self.stdout.write(self.style.SUCCESS(f"Recomputed odometer for {updated} motorcycles."))
