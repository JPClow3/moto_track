from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import UserPreference


@admin.register(UserPreference)
class UserPreferenceAdmin(ModelAdmin):
    list_display = ["user", "theme", "updated_at"]
    list_filter = ["theme"]
