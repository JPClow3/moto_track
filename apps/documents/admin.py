from django.contrib import admin

from .models import MotorcycleDocument


@admin.register(MotorcycleDocument)
class MotorcycleDocumentAdmin(admin.ModelAdmin):
	list_display = ("name", "motorcycle", "document_type", "created_at")
	list_filter = ("document_type",)
	search_fields = ("name", "motorcycle__name")

# Register your models here.
