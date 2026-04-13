from django.contrib import admin

from .models import MaintenancePart, MaintenanceRecord, MaintenanceRecordPart


@admin.register(MaintenancePart)
class MaintenancePartAdmin(admin.ModelAdmin):
	list_display = ("name", "manufacturer", "part_type", "price")
	list_filter = ("part_type",)
	search_fields = ("name", "manufacturer", "sku")


@admin.register(MaintenanceRecordPart)
class MaintenanceRecordPartAdmin(admin.ModelAdmin):
	list_display = ("maintenance_record", "part", "quantity", "unit_price")
	search_fields = ("maintenance_record__motorcycle__name", "part__name")


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
	list_display = ("date", "motorcycle", "maintenance_type", "odometer_km", "cost", "interval_km", "interval_days")
	list_filter = ("maintenance_type", "date")
	search_fields = ("motorcycle__name", "workshop", "parts__name")

# Register your models here.
