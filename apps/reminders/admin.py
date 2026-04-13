from django.contrib import admin

from .models import Reminder


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
	list_display = ("title", "motorcycle", "trigger_type", "is_active", "reference_km", "reference_date")
	list_filter = ("trigger_type", "is_active")
	search_fields = ("title", "motorcycle__name")

# Register your models here.
