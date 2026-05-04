from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimeStampedModel
from apps.garage.models import Motorcycle


class PlatformSource(models.TextChoices):
    IFOOD = "ifood", "iFood"
    UBER = "uber", "Uber"
    NINENINE = "99", "99"
    LOGGI = "loggi", "Loggi"
    PRIVATE = "private", "Particular"
    MOTOTAXI = "mototaxi", "Mototaxi"
    OTHER = "other", "Outro"


class WorkPaymentMethod(models.TextChoices):
    PIX = "pix", "Pix"
    CASH = "cash", "Dinheiro"
    CARD = "card", "Cartao"
    MIXED = "mixed", "Misto"
    OTHER = "other", "Outro"


class ProfessionalCostSettings(TimeStampedModel):
    motorcycle = models.OneToOneField(Motorcycle, on_delete=models.CASCADE, related_name="professional_cost_settings")
    maintenance_reserve_per_km = models.DecimalField(max_digits=8, decimal_places=3, default=Decimal("0.120"))
    depreciation_per_km = models.DecimalField(max_digits=8, decimal_places=3, default=Decimal("0.000"))
    fixed_daily_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        verbose_name = "Configuracao profissional"
        verbose_name_plural = "Configuracoes profissionais"

    def __str__(self) -> str:
        return f"Custos profissionais - {self.motorcycle.name}"

    def clean(self):
        errors = {}
        for field in ("maintenance_reserve_per_km", "depreciation_per_km", "fixed_daily_cost"):
            value = getattr(self, field)
            if value is not None and value < 0:
                errors[field] = "O valor nao pode ser negativo."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class WorkSession(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="work_sessions")
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="work_sessions")
    work_date = models.DateField()
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    odometer_start_km = models.PositiveIntegerField()
    odometer_end_km = models.PositiveIntegerField()
    gross_income = models.DecimalField(max_digits=10, decimal_places=2)
    tips = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    deliveries_count = models.PositiveSmallIntegerField(default=0)
    platform_source = models.CharField(max_length=24, choices=PlatformSource.choices, default=PlatformSource.OTHER)
    payment_method = models.CharField(max_length=16, choices=WorkPaymentMethod.choices, default=WorkPaymentMethod.PIX)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-work_date", "-started_at", "-created_at"]
        indexes = [
            models.Index(fields=["owner", "work_date"], name="work_owner_date_idx"),
            models.Index(fields=["motorcycle", "work_date"], name="work_moto_date_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.motorcycle.name} - {self.work_date}"

    @property
    def distance_km(self) -> int:
        return max(int(self.odometer_end_km or 0) - int(self.odometer_start_km or 0), 0)

    @property
    def total_revenue(self) -> Decimal:
        return Decimal(self.gross_income or 0) + Decimal(self.tips or 0)

    @property
    def duration_hours(self) -> Decimal:
        if not (self.started_at and self.ended_at):
            return Decimal("0")
        seconds = max((self.ended_at - self.started_at).total_seconds(), 0)
        return (Decimal(str(seconds)) / Decimal("3600")).quantize(Decimal("0.001"))

    def clean(self):
        errors = {}
        if self.motorcycle_id and self.owner_id and self.motorcycle.owner_id != self.owner_id:
            errors["motorcycle"] = "Selecione uma moto da sua garagem."
        if self.ended_at and self.started_at and self.ended_at < self.started_at:
            errors["ended_at"] = "O fim do turno nao pode ser anterior ao inicio."
        if self.odometer_end_km is not None and self.odometer_start_km is not None:
            if int(self.odometer_end_km) < int(self.odometer_start_km):
                errors["odometer_end_km"] = "O km final nao pode ser menor que o inicial."
        if self.gross_income is not None and Decimal(self.gross_income) < 0:
            errors["gross_income"] = "O faturamento nao pode ser negativo."
        if self.tips is not None and Decimal(self.tips) < 0:
            errors["tips"] = "As gorjetas nao podem ser negativas."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
