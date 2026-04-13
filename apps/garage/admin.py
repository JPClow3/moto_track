from django.contrib import admin

from .models import Motorcycle, MotorcycleSpec


@admin.register(Motorcycle)
class MotorcycleAdmin(admin.ModelAdmin):
	list_display = ("name", "brand", "model", "year", "current_odometer_km", "owner")
	search_fields = ("name", "brand", "model", "license_plate")


@admin.register(MotorcycleSpec)
class MotorcycleSpecAdmin(admin.ModelAdmin):
	list_display = ("motorcycle", "fuel_tank_capacity_l", "recommended_tire_pressure_front", "recommended_tire_pressure_rear")
	search_fields = ("motorcycle__name", "motorcycle__brand", "motorcycle__model")

# Register your models here.
