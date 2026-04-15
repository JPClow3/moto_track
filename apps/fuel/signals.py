from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.fuel.models import FuelRecord
from apps.garage.services import recompute_motorcycle_odometer


@receiver(post_save, sender=FuelRecord)
def _fuel_record_saved(sender, instance: FuelRecord, **kwargs):  # pylint: disable=unused-argument
    recompute_motorcycle_odometer(instance.motorcycle_id)


@receiver(post_delete, sender=FuelRecord)
def _fuel_record_deleted(sender, instance: FuelRecord, **kwargs):  # pylint: disable=unused-argument
    recompute_motorcycle_odometer(instance.motorcycle_id)
