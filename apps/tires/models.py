from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from djmoney.models.fields import MoneyField

from apps.core.models import TimeStampedModel, UserOwnedModel
from apps.garage.models import Motorcycle


class TireType(models.TextChoices):
    STREET = "street", "Street"
    SPORT = "sport", "Sport"
    TOURING = "touring", "Touring"
    OFF_ROAD = "off_road", "Off-road"
    SCOOTER = "scooter", "Scooter"
    OTHER = "other", "Outro"


class TireProduct(TimeStampedModel, UserOwnedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tire_products")
    manufacturer = models.CharField(max_length=80)
    model_name = models.CharField(max_length=120)
    image = models.ImageField(upload_to="tires/products/", null=True, blank=True)
    tire_type = models.CharField(max_length=24, choices=TireType.choices, default=TireType.STREET)
    width_mm = models.PositiveSmallIntegerField(null=True, blank=True)
    aspect_ratio = models.PositiveSmallIntegerField(null=True, blank=True)
    rim_diameter_in = models.PositiveSmallIntegerField(null=True, blank=True)
    load_index = models.CharField(max_length=12, blank=True)
    speed_rating = models.CharField(max_length=8, blank=True)
    max_speed_kmh = models.PositiveSmallIntegerField(null=True, blank=True)
    price = MoneyField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["manufacturer", "model_name"]
        verbose_name = "Pneu"
        verbose_name_plural = "Pneus"

    def __str__(self) -> str:
        return f"{self.manufacturer} {self.model_name}"


class TirePosition(models.TextChoices):
    FRONT = "front", "Dianteiro"
    REAR = "rear", "Traseiro"


class TireRecord(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="tire_records")
    tire_product = models.ForeignKey(
        TireProduct, on_delete=models.SET_NULL, null=True, blank=True, related_name="installations"
    )
    position = models.CharField(max_length=16, choices=TirePosition.choices)
    brand_model = models.CharField(max_length=120)
    installed_at = models.DateField()
    installed_odometer_km = models.PositiveIntegerField()
    cost = MoneyField(max_digits=10, decimal_places=2)
    purchase_price = MoneyField(max_digits=10, decimal_places=2, null=True, blank=True)
    recommended_pressure = models.CharField(max_length=32, blank=True)
    wear_percent = models.PositiveSmallIntegerField(default=0)
    estimated_change_km = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-installed_at"]
        indexes = [
            models.Index(fields=["is_active"], name="tire_record_active_idx"),
            models.Index(fields=["installed_at"], name="tire_record_installed_idx"),
        ]

    def __str__(self) -> str:
        # pylint: disable=no-member
        return f"{self.motorcycle.name} - {self.get_position_display()}"

    def clean(self):
        errors = {}
        if self.wear_percent is not None and self.wear_percent > 100:
            errors["wear_percent"] = "O desgaste deve estar entre 0 e 100%."
        if self.cost is not None and getattr(self.cost, "amount", self.cost) < 0:
            errors["cost"] = "O custo não pode ser negativo."
        if self.purchase_price is not None and getattr(self.purchase_price, "amount", self.purchase_price) < 0:
            errors["purchase_price"] = "O preço de compra não pode ser negativo."
        if errors:
            raise ValidationError(errors)


class TirePressureRecord(TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="tire_pressure_records")
    date = models.DateField()
    psi_front = models.PositiveSmallIntegerField()
    psi_rear = models.PositiveSmallIntegerField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.motorcycle.name} - {self.date}"
