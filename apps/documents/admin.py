from django.contrib import admin

from apps.core.admin import UserScopedAdmin

from apps.garage.models import Motorcycle

from .models import MotorcycleDocument


@admin.register(MotorcycleDocument)
class MotorcycleDocumentAdmin(UserScopedAdmin):
	foreign_key_scopes = {"motorcycle": lambda user: Motorcycle.objects.filter(owner=user)}

	list_display = ("name", "motorcycle", "document_type", "created_at")
	list_filter = ("document_type",)
	search_fields = ("name", "motorcycle__name")

# Register your models here.
