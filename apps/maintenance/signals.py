from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.garage.services import recompute_motorcycle_odometer
from apps.maintenance.models import MaintenanceRecord


@receiver(post_save, sender=MaintenanceRecord)
def _maintenance_record_saved(sender, instance: MaintenanceRecord, **kwargs):  # pylint: disable=unused-argument
    recompute_motorcycle_odometer(instance.motorcycle_id)


@receiver(post_delete, sender=MaintenanceRecord)
def _maintenance_record_deleted(sender, instance: MaintenanceRecord, **kwargs):  # pylint: disable=unused-argument
    recompute_motorcycle_odometer(instance.motorcycle_id)
