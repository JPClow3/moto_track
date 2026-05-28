from django.contrib import admin

from apps.core.admin import UserScopedAdmin
from apps.garage.models import Motorcycle

from .models import Reminder


@admin.register(Reminder)
class ReminderAdmin(UserScopedAdmin):
    owner_lookup = "motorcycle__owner"
    foreign_key_scopes = {"motorcycle": lambda user: Motorcycle.objects.filter(owner=user)}

    list_display = ("title", "motorcycle", "trigger_type", "is_active", "send_email", "send_push", "reference_km", "reference_date")
    list_filter = ("trigger_type", "is_active", "send_email", "send_push")
    search_fields = ("title", "motorcycle__name")


# Register your models here.
