from django.contrib import admin

from apps.core.admin import UserScopedAdmin

from .models import Motorcycle, MotorcycleSpec


@admin.register(Motorcycle)
class MotorcycleAdmin(UserScopedAdmin):
	list_display = ("name", "brand", "model", "year", "current_odometer_km", "photo", "owner")
	search_fields = ("name", "brand", "model", "license_plate")


@admin.register(MotorcycleSpec)
class MotorcycleSpecAdmin(UserScopedAdmin):
	owner_lookup = "motorcycle__owner"
	foreign_key_scopes = {"motorcycle": lambda user: Motorcycle.objects.filter(owner=user)}

	list_display = ("motorcycle", "fuel_tank_capacity_l", "recommended_tire_pressure_front", "recommended_tire_pressure_rear")
	search_fields = ("motorcycle__name", "motorcycle__brand", "motorcycle__model")

# Register your models here.
