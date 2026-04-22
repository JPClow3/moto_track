from django.contrib import admin

from apps.core.admin import UserScopedAdmin
from .models import InventoryItem


@admin.register(InventoryItem)
class InventoryItemAdmin(UserScopedAdmin):
    list_display = ("name", "owner", "part_number", "quantity", "unit_cost", "updated_at")
    list_filter = ("owner", "created_at")
    search_fields = ("name", "part_number", "description")
    ordering = ("name",)
