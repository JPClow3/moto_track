from django.db import models

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
	manufacturer = models.CharField(max_length=80)
	model_name = models.CharField(max_length=120)
	tire_type = models.CharField(max_length=24, choices=TireType.choices, default=TireType.STREET)
	width_mm = models.PositiveSmallIntegerField(null=True, blank=True)
	aspect_ratio = models.PositiveSmallIntegerField(null=True, blank=True)
	rim_diameter_in = models.PositiveSmallIntegerField(null=True, blank=True)
	load_index = models.CharField(max_length=12, blank=True)
	speed_rating = models.CharField(max_length=8, blank=True)
	max_speed_kmh = models.PositiveSmallIntegerField(null=True, blank=True)
	price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
	notes = models.TextField(blank=True)

	class Meta:
		ordering = ["manufacturer", "model_name"]
		verbose_name = "Pneu"
		verbose_name_plural = "Pneus"

	def __str__(self):
		return f"{self.manufacturer} {self.model_name}"


class TirePosition(models.TextChoices):
	FRONT = "front", "Dianteiro"
	REAR = "rear", "Traseiro"


class TireRecord(models.Model):
	motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="tire_records")
	tire_product = models.ForeignKey(TireProduct, on_delete=models.SET_NULL, null=True, blank=True, related_name="installations")
	position = models.CharField(max_length=16, choices=TirePosition.choices)
	brand_model = models.CharField(max_length=120)
	installed_at = models.DateField()
	installed_odometer_km = models.PositiveIntegerField()
	cost = models.DecimalField(max_digits=10, decimal_places=2)
	purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
	recommended_pressure = models.CharField(max_length=32, blank=True)
	wear_percent = models.PositiveSmallIntegerField(default=0)
	estimated_change_km = models.PositiveIntegerField(null=True, blank=True)
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-installed_at"]

	def __str__(self):
		return f"{self.motorcycle.name} - {self.get_position_display()}"

# Create your models here.
