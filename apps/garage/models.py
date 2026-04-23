from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel, UserOwnedModel

MAINTENANCE_TYPE_CHOICES = (
    ("oil_change", "Troca de oleo"),
    ("oil_filter", "Filtro de oleo"),
    ("air_filter", "Filtro de ar"),
    ("chain_set", "Relacao"),
    ("brake_pad", "Pastilha de freio"),
    ("spark_plug", "Vela"),
    ("battery", "Bateria"),
    ("review", "Revisao"),
    ("labor", "Mao de obra"),
    ("other", "Outro"),
)

WINDOWS_ABSOLUTE_PATH_RE = re.compile(r"^[A-Za-z]:[\\/].+")


class RidingProfile(models.TextChoices):
    AUTO = "auto", "Automático"
    URBAN = "urban", "Urbano"
    MIXED = "mixed", "Misto"
    HIGHWAY = "highway", "Estrada"
    SEVERE = "severe", "Uso severo"


class MotorcycleTemplate(TimeStampedModel):
    brand = models.CharField(max_length=80)
    model = models.CharField(max_length=120)
    year_from = models.PositiveIntegerField()
    year_to = models.PositiveIntegerField(null=True, blank=True)
    variant = models.CharField(max_length=80, blank=True)
    engine_cc = models.PositiveIntegerField()
    country_code = models.CharField(max_length=2, default="BR")

    class Meta:
        ordering = ["brand", "model", "year_from", "variant"]
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "model", "year_from", "year_to", "variant", "country_code"],
                name="garage_tpl_brand_model_year_variant_country_uniq",
            )
        ]

    @property
    def year_label(self) -> str:
        if self.year_to:
            return f"{self.year_from}-{self.year_to}"
        return f"{self.year_from}+"

    def clean(self):
        errors = {}
        if self.year_to is not None and self.year_to < self.year_from:
            errors["year_to"] = "O ano final nao pode ser menor que o ano inicial."
        if self.engine_cc <= 0:
            errors["engine_cc"] = "A cilindrada deve ser maior que zero."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        variant = f" {self.variant}" if self.variant else ""
        return f"{self.brand} {self.model}{variant} ({self.year_label})"


class MotorcycleTemplateSpec(TimeStampedModel):
    template = models.OneToOneField(MotorcycleTemplate, on_delete=models.CASCADE, related_name="spec")
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
    manual_url = models.CharField(max_length=500, blank=True)
    consumption_avg_km_l = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Especificacao do template"
        verbose_name_plural = "Especificacoes dos templates"

    def clean(self):
        errors = {}
        for field_name in ("fuel_tank_capacity_l", "oil_capacity_l"):
            value = getattr(self, field_name)
            if value is not None and value <= 0:
                errors[field_name] = "O valor deve ser maior que zero."
        if self.fuel_octane_min is not None and self.fuel_octane_min <= 0:
            errors["fuel_octane_min"] = "A octanagem minima deve ser maior que zero."
        manual_source = (self.manual_url or "").strip()
        if manual_source:
            parsed = urlparse(manual_source)
            if parsed.scheme in {"http", "https"}:
                if not parsed.netloc:
                    errors["manual_url"] = "Informe uma URL HTTP/HTTPS válida para o manual."
            elif parsed.scheme == "file":
                errors["manual_url"] = "Use URL HTTP/HTTPS ou caminho interno relativo para o manual."
                if not parsed.path:
                    errors["manual_url"] = "Informe uma URL file:// válida para o manual."
            elif parsed.scheme:
                errors["manual_url"] = "Use URL HTTP/HTTPS ou caminho interno relativo para o manual."
                if not WINDOWS_ABSOLUTE_PATH_RE.match(manual_source):
                    errors["manual_url"] = "Use http(s), file:// ou caminho interno para o manual."
            elif manual_source.startswith("//"):
                errors["manual_url"] = "Caminho interno inválido para o manual."
            if Path(manual_source).is_absolute() or ".." in Path(manual_source).parts:
                errors["manual_url"] = "Caminho interno inválido para o manual."
            self.manual_url = manual_source
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return f"Specs - {self.template}"


class MotorcycleTemplateMaintenanceInterval(TimeStampedModel):
    template = models.ForeignKey(
        MotorcycleTemplate,
        on_delete=models.CASCADE,
        related_name="maintenance_intervals",
    )
    maintenance_type = models.CharField(max_length=32, choices=MAINTENANCE_TYPE_CHOICES)
    interval_km = models.PositiveIntegerField(null=True, blank=True)
    interval_days = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_severe_duty_override = models.BooleanField(default=False)

    class Meta:
        ordering = ["maintenance_type", "is_severe_duty_override", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["template", "maintenance_type", "is_severe_duty_override"],
                name="garage_tpl_interval_unique_by_type_and_severe",
            )
        ]

    def clean(self):
        errors = {}
        if self.interval_km is None and self.interval_days is None:
            errors["interval_km"] = "Informe intervalo em km e/ou em dias."
            errors["interval_days"] = "Informe intervalo em km e/ou em dias."
        if self.interval_km is not None and self.interval_km <= 0:
            errors["interval_km"] = "O intervalo em km deve ser maior que zero."
        if self.interval_days is not None and self.interval_days <= 0:
            errors["interval_days"] = "O intervalo em dias deve ser maior que zero."
        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        suffix = " (uso severo)" if self.is_severe_duty_override else ""
        return f"{self.template} - {self.maintenance_type}{suffix}"


class MotorcycleTemplateRecommendedPart(TimeStampedModel):
    template = models.ForeignKey(
        MotorcycleTemplate,
        on_delete=models.CASCADE,
        related_name="recommended_parts",
    )
    maintenance_type = models.CharField(max_length=32, choices=MAINTENANCE_TYPE_CHOICES)
    part_name = models.CharField(max_length=140)
    manufacturer = models.CharField(max_length=80, blank=True)
    part_number = models.CharField(max_length=80, blank=True)
    notes = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["part_name", "manufacturer"]
        constraints = [
            models.UniqueConstraint(
                fields=["template", "part_name", "maintenance_type"],
                name="garage_tpl_part_unique_by_template_name_type",
            )
        ]

    def __str__(self) -> str:
        return f"{self.part_name} ({self.template})"


class Motorcycle(TimeStampedModel, UserOwnedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="motorcycles")
    name = models.CharField(max_length=120)
    brand = models.CharField(max_length=80)
    model = models.CharField(max_length=120)
    year = models.PositiveIntegerField()
    source_template = models.ForeignKey(
        MotorcycleTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="derived_motorcycles",
    )
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
    riding_profile = models.CharField(max_length=16, choices=RidingProfile.choices, default=RidingProfile.AUTO)
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

    def reactivate(self) -> None:
        if self.is_active:
            return
        self.is_active = True
        self.deleted_at = None
        self.save(update_fields=["is_active", "deleted_at"])

    def set_current_odometer(self, value_km: int) -> None:
        value_km = max(int(value_km or 0), 0)
        self.current_odometer_km = value_km
        self.current_odometer_updated_at = timezone.now()
        self.save(update_fields=["current_odometer_km", "current_odometer_updated_at"])

    def save(self, *args, **kwargs):  # pylint: disable=signature-differs
        update_fields = kwargs.get("update_fields")
        override = int(self.odometer_override_km or 0)
        needs_recompute = False
        if self.pk and (update_fields is None or "odometer_override_km" in update_fields):
            previous = (
                type(self).objects.filter(pk=self.pk)
                .values("odometer_override_km", "current_odometer_km")
                .first()
            )
            if previous:
                previous_override = int(previous["odometer_override_km"] or 0)
                previous_current = int(previous["current_odometer_km"] or 0)
                needs_recompute = override != previous_override and override < previous_current
        if override and override > int(self.current_odometer_km or 0):
            self.current_odometer_km = override
            self.current_odometer_updated_at = timezone.now()
            if update_fields is not None:
                kwargs["update_fields"] = list(set(update_fields) | {"current_odometer_km", "current_odometer_updated_at"})
            needs_recompute = False
        result = super().save(*args, **kwargs)
        if needs_recompute:
            from apps.garage.services import recompute_motorcycle_odometer

            recompute_motorcycle_odometer(self.pk)
        return result


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
    consumption_avg_km_l = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Especificação da moto"
        verbose_name_plural = "Especificações da moto"

    def __str__(self) -> str:
        return f"Specs - {self.motorcycle.name}"
