from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel, UserOwnedModel
from apps.garage.models import Motorcycle


class MaintenanceType(models.TextChoices):
    OIL_CHANGE = "oil_change", "Troca de oleo"
    OIL_FILTER = "oil_filter", "Filtro de oleo"
    AIR_FILTER = "air_filter", "Filtro de ar"
    CHAIN_SET = "chain_set", "Relacao"
    BRAKE_PAD = "brake_pad", "Pastilha de freio"
    SPARK_PLUG = "spark_plug", "Vela"
    BATTERY = "battery", "Bateria"
    REVIEW = "review", "Revisao"
    LABOR = "labor", "Mao de obra"
    OTHER = "other", "Outro"


class MaintenancePartType(models.TextChoices):
    OIL = "oil", "Óleo"
    FILTER = "filter", "Filtro"
    CHAIN = "chain", "Corrente/Transmissão"
    SPARK_PLUG = "spark_plug", "Vela"
    BATTERY = "battery", "Bateria"
    BRAKE_PAD = "brake_pad", "Pastilha"
    TIRE = "tire", "Pneu"
    LABOR = "labor", "Mão de obra"
    OTHER = "other", "Outro"


class MaintenancePart(TimeStampedModel, UserOwnedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="maintenance_parts")
    name = models.CharField(max_length=140)
    manufacturer = models.CharField(max_length=80, blank=True)
    part_type = models.CharField(max_length=24, choices=MaintenancePartType.choices, default=MaintenancePartType.OTHER)
    sku = models.CharField(max_length=80, blank=True)
    price = MoneyField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("owner", "name")]

    def __str__(self) -> str:
        return str(self.name)


class MaintenanceRecord(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="maintenance_records")
    maintenance_type = models.CharField(max_length=32, choices=MaintenanceType.choices, default=MaintenanceType.OTHER)
    parts = models.ManyToManyField(
        MaintenancePart, through="MaintenanceRecordPart", blank=True, related_name="maintenance_records"
    )
    date = models.DateField()
    odometer_km = models.PositiveIntegerField()
    description = models.TextField(blank=True)
    parts_used = models.TextField(blank=True)
    cost = MoneyField(max_digits=10, decimal_places=2, default=0)
    workshop = models.CharField(max_length=120, blank=True)
    interval_km = models.PositiveIntegerField(null=True, blank=True)
    interval_days = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-date", "-odometer_km"]
        indexes = [
            models.Index(fields=["date"], name="maint_record_date_idx"),
            models.Index(fields=["maintenance_type"], name="maint_record_type_idx"),
        ]

    def __str__(self) -> str:
        try:
            maintenance_label = MaintenanceType(self.maintenance_type).label
        except ValueError:
            maintenance_label = self.maintenance_type
        return f"{self.motorcycle.name} - {maintenance_label}"

    @property
    def computed_next_change_km(self):
        if self.interval_km:
            return self.odometer_km + self.interval_km
        return None

    @property
    def computed_next_change_date(self):
        if self.interval_days:
            return self.date + timedelta(days=self.interval_days)
        return None

    def clean(self):
        errors = {}
        if self.interval_km is not None and self.interval_km <= 0:
            errors["interval_km"] = "O intervalo em km deve ser maior que zero."
        if self.interval_days is not None and self.interval_days <= 0:
            errors["interval_days"] = "O intervalo em dias deve ser maior que zero."
        if self.cost is not None and getattr(self.cost, "amount", self.cost) < 0:
            errors["cost"] = "O custo não pode ser negativo."
        if errors:
            raise ValidationError(errors)


class MaintenanceRecordPart(TimeStampedModel):
    maintenance_record = models.ForeignKey(MaintenanceRecord, on_delete=models.CASCADE)
    part = models.ForeignKey(MaintenancePart, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = MoneyField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["part__name"]
        unique_together = [("maintenance_record", "part")]

    def __str__(self) -> str:
        return f"{self.part} x{self.quantity}"


class MaintenancePlanItem(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="maintenance_plan_items")
    maintenance_type = models.CharField(max_length=32, choices=MaintenanceType.choices, default=MaintenanceType.OTHER)
    interval_km = models.PositiveIntegerField(null=True, blank=True)
    interval_days = models.PositiveIntegerField(null=True, blank=True)
    last_done_km = models.PositiveIntegerField(null=True, blank=True)
    last_done_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["maintenance_type", "-is_active", "-updated_at"]
        unique_together = [("motorcycle", "maintenance_type")]

    def clean(self):
        errors = {}
        if self.interval_km is not None and self.interval_km <= 0:
            errors["interval_km"] = "O intervalo em km deve ser maior que zero."
        if self.interval_days is not None and self.interval_days <= 0:
            errors["interval_days"] = "O intervalo em dias deve ser maior que zero."
        if errors:
            raise ValidationError(errors)
