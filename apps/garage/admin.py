from django.contrib import admin
from unfold.admin import ModelAdmin, StackedInline, TabularInline

from apps.core.admin import UserScopedAdmin

from .models import (
    Motorcycle,
    MotorcycleSpec,
    MotorcycleTemplate,
    MotorcycleTemplateMaintenanceInterval,
    MotorcycleTemplateRecommendedPart,
    MotorcycleTemplateSpec,
)


class MotorcycleTemplateSpecInline(StackedInline):
    model = MotorcycleTemplateSpec
    extra = 0
    max_num = 1


class MotorcycleTemplateMaintenanceIntervalInline(TabularInline):
    model = MotorcycleTemplateMaintenanceInterval
    extra = 0


class MotorcycleTemplateRecommendedPartInline(TabularInline):
    model = MotorcycleTemplateRecommendedPart
    extra = 0


@admin.register(MotorcycleTemplate)
class MotorcycleTemplateAdmin(ModelAdmin):
    list_display = (
        "brand",
        "model",
        "variant",
        "year_from",
        "year_to",
        "engine_cc",
        "country_code",
    )
    list_filter = ("brand", "country_code")
    search_fields = ("brand", "model", "variant")
    inlines = [
        MotorcycleTemplateSpecInline,
        MotorcycleTemplateMaintenanceIntervalInline,
        MotorcycleTemplateRecommendedPartInline,
    ]


@admin.register(Motorcycle)
class MotorcycleAdmin(UserScopedAdmin):
    list_display = (
        "name",
        "brand",
        "model",
        "year",
        "source_template",
        "riding_profile",
        "current_odometer_km",
        "photo",
        "owner",
    )
    list_filter = ("riding_profile", "source_template")
    search_fields = ("name", "brand", "model", "license_plate")


@admin.register(MotorcycleSpec)
class MotorcycleSpecAdmin(UserScopedAdmin):
    owner_lookup = "motorcycle__owner"
    foreign_key_scopes = {"motorcycle": lambda user: Motorcycle.objects.filter(owner=user)}

    list_display = (
        "motorcycle",
        "fuel_tank_capacity_l",
        "recommended_tire_pressure_front",
        "recommended_tire_pressure_rear",
    )
    search_fields = ("motorcycle__name", "motorcycle__brand", "motorcycle__model")
