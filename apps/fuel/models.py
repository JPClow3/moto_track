from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Value
from django.db.models.functions import Coalesce
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel, UserOwnedModel
from apps.garage.models import Motorcycle


class FuelType(models.TextChoices):
    GASOLINE = "gasoline", "Gasolina"
    ETHANOL = "ethanol", "Etanol"
    PREMIUM_GASOLINE = "premium_gasoline", "Gasolina Aditivada"
    PREMIUM_ETHANOL = "premium_ethanol", "Etanol Premium"


def validate_receipt_file(file_obj):
    if not file_obj:
        return

    max_size = 10 * 1024 * 1024
    if file_obj.size and file_obj.size > max_size:
        raise ValidationError("O comprovante deve ter no máximo 10 MB.")

    name = (file_obj.name or "").lower()
    allowed_extensions = (".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic")
    if not name.endswith(allowed_extensions):
        raise ValidationError("Envie um comprovante em imagem ou PDF.")


class FuelStation(TimeStampedModel, UserOwnedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fuel_stations")
    name = models.CharField(max_length=120)
    brand = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    state = models.CharField(max_length=2, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("owner", "name")]

    def __str__(self) -> str:
        return str(self.name)


class FuelGrade(TimeStampedModel, UserOwnedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fuel_grades")
    name = models.CharField(max_length=120)
    fuel_type = models.CharField(max_length=32, choices=FuelType.choices, default=FuelType.GASOLINE)
    octane_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    ethanol_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    default_price_per_liter = MoneyField(max_digits=8, decimal_places=3, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("owner", "name")]

    def __str__(self) -> str:
        return str(self.name)


class FuelRecord(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="fuel_records")
    station = models.ForeignKey(
        FuelStation, on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_records"
    )
    fuel_grade = models.ForeignKey(
        FuelGrade, on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_records"
    )
    date = models.DateField()
    odometer_km = models.PositiveIntegerField(help_text="Odômetro da moto no momento do abastecimento")
    liters = models.DecimalField(max_digits=7, decimal_places=3)
    total_price = MoneyField(max_digits=10, decimal_places=2)
    price_per_liter = MoneyField(max_digits=8, decimal_places=3)
    fuel_type = models.CharField(max_length=32, choices=FuelType.choices, default=FuelType.GASOLINE)
    tank_full = models.BooleanField(default=False)
    receipt_file = models.FileField(
        upload_to="fuel/receipts/%Y/%m/",
        blank=True,
        validators=[validate_receipt_file],
    )
    station_name = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-odometer_km"]
        indexes = [
            models.Index(fields=["date"], name="fuel_record_date_idx"),
            models.Index(fields=["motorcycle", "date"], name="fuel_record_moto_date_idx"),
            models.Index(fields=["motorcycle", "date", "odometer_km"], name="fuel_moto_date_odo_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.motorcycle.name} - {self.date} - {self.total_price}"

    def clean(self):
        super().clean()
        errors = {}
        if self.liters is not None and self.liters <= 0:
            errors["liters"] = "A quantidade de litros deve ser maior que zero."
        if self.total_price is not None and getattr(self.total_price, "amount", self.total_price) < 0:
            errors["total_price"] = "O valor total não pode ser negativo."
        if self.price_per_liter is not None and getattr(self.price_per_liter, "amount", self.price_per_liter) <= 0:
            errors["price_per_liter"] = "O preço por litro deve ser maior que zero."
        from apps.core.validation import validate_instance_odometer
        errors.update(validate_instance_odometer(self))
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class FuelPreference(TimeStampedModel, UserOwnedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fuel_preferences")
    motorcycle = models.ForeignKey(
        Motorcycle, on_delete=models.CASCADE, null=True, blank=True, related_name="fuel_preferences"
    )
    station = models.ForeignKey(
        FuelStation, on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_preferences"
    )
    fuel_grade = models.ForeignKey(
        FuelGrade, on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_preferences"
    )
    fuel_type = models.CharField(max_length=32, choices=FuelType.choices, default=FuelType.GASOLINE)
    station_name = models.CharField(max_length=120, blank=True)
    price_per_liter = MoneyField(max_digits=8, decimal_places=3, null=True, blank=True)
    tank_full = models.BooleanField(default=True)
    use_count = models.PositiveIntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_used_at", "-use_count", "-updated_at"]
        constraints = [
            models.UniqueConstraint(
                "owner",
                Coalesce("motorcycle_id", Value(0)),
                Coalesce("station_id", Value(0)),
                Coalesce("fuel_grade_id", Value(0)),
                "fuel_type",
                "station_name",
                name="fuel_preference_unique_pattern",
            )
        ]

    def __str__(self) -> str:
        label = self.station.name if self.station else self.station_name or self.get_fuel_type_display()
        return f"{self.owner} - {label}"


class FuelReviewPreference(TimeStampedModel):
    motorcycle = models.OneToOneField(Motorcycle, on_delete=models.CASCADE, related_name="fuel_review_preference")
    fillups_interval = models.PositiveSmallIntegerField(default=10)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Regra de revisão por abastecimento"
        verbose_name_plural = "Regras de revisão por abastecimento"

    def __str__(self) -> str:
        return f"{self.motorcycle.name} - revisão a cada {self.fillups_interval} abastecimentos"

    def clean(self):
        super().clean()
        if self.fillups_interval <= 0:
            raise ValidationError({"fillups_interval": "O intervalo deve ser maior que zero."})
