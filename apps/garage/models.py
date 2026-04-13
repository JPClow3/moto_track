from django.db import models
from django.db.models import Max

from apps.core.models import TimeStampedModel, UserOwnedModel


class Motorcycle(TimeStampedModel, UserOwnedModel):
	name = models.CharField(max_length=120)
	brand = models.CharField(max_length=80)
	model = models.CharField(max_length=120)
	year = models.PositiveIntegerField()
	license_plate = models.CharField(max_length=16, blank=True)
	odometer_override_km = models.PositiveIntegerField(null=True, blank=True)
	odometer_override_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ["name"]
		unique_together = [("owner", "name")]

	def __str__(self):
		return f"{self.name} ({self.brand} {self.model})"

	@property
	def computed_odometer_km(self):
		fuel_max = self.fuel_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
		maintenance_max = self.maintenance_records.aggregate(max_odometer=Max("odometer_km"))["max_odometer"] or 0
		return max(fuel_max, maintenance_max)

	@property
	def current_odometer_km(self):
		override = self.odometer_override_km or 0
		return max(self.computed_odometer_km, override)


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

	def __str__(self):
		return f"Specs - {self.motorcycle.name}"
