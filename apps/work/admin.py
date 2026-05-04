from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import ProfessionalCostSettings, WorkSession


@admin.register(WorkSession)
class WorkSessionAdmin(ModelAdmin):
    list_display = ["owner", "motorcycle", "work_date", "gross_income", "tips", "distance_km"]
    list_filter = ["work_date", "platform_source", "payment_method"]
    search_fields = ["owner__username", "owner__email", "motorcycle__name"]


@admin.register(ProfessionalCostSettings)
class ProfessionalCostSettingsAdmin(ModelAdmin):
    list_display = ["motorcycle", "maintenance_reserve_per_km", "depreciation_per_km", "fixed_daily_cost"]
    search_fields = ["motorcycle__name", "motorcycle__owner__username"]
