from __future__ import annotations

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.garage.services import bump_motorcycle_odometer, recompute_motorcycle_odometer
from apps.maintenance.models import MaintenanceRecord, MaintenancePlanItem


@receiver(pre_save, sender=MaintenanceRecord)
def _maintenance_record_snapshot(sender, instance: MaintenanceRecord, **kwargs):  # pylint: disable=unused-argument
    if not instance.pk:
        instance._odometer_snapshot = None
        return
    instance._odometer_snapshot = (
        MaintenanceRecord.objects.filter(pk=instance.pk).values_list("motorcycle_id", "odometer_km").first()
    )


@receiver(post_save, sender=MaintenanceRecord)
def _maintenance_record_saved(sender, instance: MaintenanceRecord, **kwargs):  # pylint: disable=unused-argument
    snapshot = getattr(instance, "_odometer_snapshot", None)
    if snapshot is None:
        bump_motorcycle_odometer(instance.motorcycle_id, instance.odometer_km)
        return
    old_motorcycle_id, old_odometer = snapshot
    if old_motorcycle_id != instance.motorcycle_id:
        recompute_motorcycle_odometer(old_motorcycle_id)
        bump_motorcycle_odometer(instance.motorcycle_id, instance.odometer_km)
    elif int(old_odometer or 0) != int(instance.odometer_km or 0):
        if int(instance.odometer_km or 0) >= int(old_odometer or 0):
            bump_motorcycle_odometer(instance.motorcycle_id, instance.odometer_km)
        else:
            recompute_motorcycle_odometer(instance.motorcycle_id)


@receiver(post_delete, sender=MaintenanceRecord)
def _maintenance_record_deleted(sender, instance: MaintenanceRecord, **kwargs):  # pylint: disable=unused-argument
    recompute_motorcycle_odometer(instance.motorcycle_id)


@receiver(post_save, sender=MaintenancePlanItem)
def _maintenance_plan_saved(sender, instance: MaintenancePlanItem, **kwargs):
    from apps.reminders.services import sync_maintenance_reminders
    sync_maintenance_reminders(instance)


@receiver(post_delete, sender=MaintenancePlanItem)
def _maintenance_plan_deleted(sender, instance: MaintenancePlanItem, **kwargs):
    from apps.reminders.models import Reminder
    Reminder.objects.filter(linked_plan_item=instance).delete()
