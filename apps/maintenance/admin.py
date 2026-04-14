from django.contrib import admin

from apps.core.admin import UserScopedAdmin
from apps.garage.models import Motorcycle

from .models import MaintenancePart, MaintenanceRecord, MaintenanceRecordPart


@admin.register(MaintenancePart)
class MaintenancePartAdmin(UserScopedAdmin):
	list_display = ("name", "manufacturer", "part_type", "price")
	list_filter = ("part_type",)
	search_fields = ("name", "manufacturer", "sku")


@admin.register(MaintenanceRecordPart)
class MaintenanceRecordPartAdmin(UserScopedAdmin):
	owner_lookup = "maintenance_record__motorcycle__owner"
	foreign_key_scopes = {
		"maintenance_record": lambda user: MaintenanceRecord.objects.filter(motorcycle__owner=user),
		"part": lambda user: MaintenancePart.objects.filter(owner=user),
	}

	list_display = ("maintenance_record", "part", "quantity", "unit_price")
	search_fields = ("maintenance_record__motorcycle__name", "part__name")


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(UserScopedAdmin):
	owner_lookup = "motorcycle__owner"
	foreign_key_scopes = {
		"motorcycle": lambda user: Motorcycle.objects.filter(owner=user),
	}

	list_display = ("date", "motorcycle", "maintenance_type", "odometer_km", "cost", "interval_km", "interval_days")
	list_filter = ("maintenance_type", "date")
	search_fields = ("motorcycle__name", "workshop", "parts__name")

# Register your models here.
