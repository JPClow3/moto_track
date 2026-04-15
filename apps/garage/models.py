from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel, UserOwnedModel


class Motorcycle(TimeStampedModel, UserOwnedModel):
    name = models.CharField(max_length=120)
    brand = models.CharField(max_length=80)
    model = models.CharField(max_length=120)
    year = models.PositiveIntegerField()
    photo = models.ImageField(upload_to="motorcycles/", null=True, blank=True)
    license_plate = models.CharField(max_length=16, blank=True)

    is_active = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Manual override (e.g. user corrects the odometer)
    odometer_override_km = models.PositiveIntegerField(null=True, blank=True)
    odometer_override_at = models.DateTimeField(null=True, blank=True)

    # Denormalized effective odometer (max of override and record maxima)
    current_odometer_km = models.PositiveIntegerField(default=0)
    current_odometer_updated_at = models.DateTimeField(null=True, blank=True)

    previous_owners = models.PositiveSmallIntegerField(null=True, blank=True)
    purchase_price = MoneyField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default_currency=settings.DEFAULT_CURRENCY,
    )
    purchase_date = models.DateField(null=True, blank=True)
    observations = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("owner", "name")]

    def __str__(self) -> str:
        return f"{self.name} ({self.brand} {self.model})"

    def deactivate(self) -> None:
        if not self.is_active:
            return
        self.is_active = False
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_active", "deleted_at"])

    def set_current_odometer(self, value_km: int) -> None:
        value_km = max(int(value_km or 0), 0)
        self.current_odometer_km = value_km
        self.current_odometer_updated_at = timezone.now()
        self.save(update_fields=["current_odometer_km", "current_odometer_updated_at"])

    def save(self, *args, **kwargs):  # pylint: disable=signature-differs
        update_fields = kwargs.get("update_fields")
        override = int(self.odometer_override_km or 0)
        if override and override > int(self.current_odometer_km or 0):
            self.current_odometer_km = override
            self.current_odometer_updated_at = timezone.now()
            if update_fields is not None:
                kwargs["update_fields"] = set(update_fields) | {"current_odometer_km", "current_odometer_updated_at"}
        return super().save(*args, **kwargs)


class MotorcycleSpec(TimeStampedModel):
    motorcycle = models.OneToOneField(Motorcycle, on_delete=models.CASCADE, related_name="spec")
    fuel_tank_capacity_l = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fuel_type_recommendation = models.CharField(max_length=80, blank=True)
    fuel_octane_min = models.PositiveSmallIntegerField(null=True, blank=True)
    oil_capacity_l = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    tire_size_front = models.CharField(max_length=32, blank=True)
    tire_size_rear = models.CharField(max_length=32, blank=True)
    tire_speed_rating = models.CharField(max_length=8, blank=True)
    battery_spec = models.CharField(max_length=80, blank=True)
    chain_size = models.CharField(max_length=32, blank=True)
    recommended_tire_pressure_front = models.CharField(max_length=32, blank=True)
    recommended_tire_pressure_rear = models.CharField(max_length=32, blank=True)
    oil_type_recommendation = models.CharField(max_length=80, blank=True)
    oil_viscosity_recommendation = models.CharField(max_length=32, blank=True)
    manual_reference = models.CharField(max_length=120, blank=True)

    class Meta:
        verbose_name = "Especificação da moto"
        verbose_name_plural = "Especificações da moto"

    def __str__(self) -> str:
        return f"Specs - {self.motorcycle.name}"
