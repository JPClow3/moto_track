from django.core.exceptions import ValidationError
from django.db import models
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel, UserOwnedModel
from apps.garage.models import Motorcycle


class FuelType(models.TextChoices):
    GASOLINE = "gasoline", "Gasolina"
    ETHANOL = "ethanol", "Etanol"
    PREMIUM_GASOLINE = "premium_gasoline", "Gasolina Aditivada"
    PREMIUM_ETHANOL = "premium_ethanol", "Etanol Premium"


class FuelStation(TimeStampedModel, UserOwnedModel):
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
    station_name = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-odometer_km"]

    def __str__(self) -> str:
        return f"{self.motorcycle.name} - {self.date} - {self.total_price}"

    def clean(self):
        errors = {}
        if self.liters is not None and self.liters <= 0:
            errors["liters"] = "A quantidade de litros deve ser maior que zero."
        if self.total_price is not None and getattr(self.total_price, "amount", self.total_price) < 0:
            errors["total_price"] = "O valor total não pode ser negativo."
        if self.price_per_liter is not None and getattr(self.price_per_liter, "amount", self.price_per_liter) <= 0:
            errors["price_per_liter"] = "O preço por litro deve ser maior que zero."
        if errors:
            raise ValidationError(errors)


class FuelPreference(TimeStampedModel, UserOwnedModel):
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

    def __str__(self) -> str:
        label = self.station.name if self.station else self.station_name or self.get_fuel_type_display()
        return f"{self.owner} - {label}"
