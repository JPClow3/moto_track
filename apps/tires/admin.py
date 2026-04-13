from django.contrib import admin

from .models import TireProduct, TireRecord


@admin.register(TireProduct)
class TireProductAdmin(admin.ModelAdmin):
	list_display = ("manufacturer", "model_name", "tire_type", "max_speed_kmh", "price")
	list_filter = ("tire_type",)
	search_fields = ("manufacturer", "model_name")


@admin.register(TireRecord)
class TireRecordAdmin(admin.ModelAdmin):
	list_display = ("motorcycle", "tire_product", "position", "brand_model", "installed_at", "wear_percent", "is_active")
	list_filter = ("position", "is_active")
	search_fields = ("motorcycle__name", "brand_model", "tire_product__manufacturer", "tire_product__model_name")

# Register your models here.
