from django.contrib import admin

from apps.core.admin import UserScopedAdmin
from apps.garage.models import Motorcycle

from .models import FuelGrade, FuelRecord, FuelStation


@admin.register(FuelStation)
class FuelStationAdmin(UserScopedAdmin):
    list_display = ("name", "brand", "city", "state")
    search_fields = ("name", "brand", "city")


@admin.register(FuelGrade)
class FuelGradeAdmin(UserScopedAdmin):
    list_display = ("name", "fuel_type", "octane_rating", "default_price_per_liter")
    list_filter = ("fuel_type",)
    search_fields = ("name",)


@admin.register(FuelRecord)
class FuelRecordAdmin(UserScopedAdmin):
    owner_lookup = "motorcycle__owner"
    foreign_key_scopes = {
        "motorcycle": lambda user: Motorcycle.objects.filter(owner=user),
        "station": lambda user: FuelStation.objects.filter(owner=user),
        "fuel_grade": lambda user: FuelGrade.objects.filter(owner=user),
    }

    list_display = (
        "date",
        "motorcycle",
        "station",
        "fuel_grade",
        "odometer_km",
        "liters",
        "total_price",
        "fuel_type",
        "tank_full",
    )
    list_filter = ("fuel_type", "date")
    search_fields = ("station_name", "motorcycle__name", "station__name", "fuel_grade__name")


# Register your models here.
