from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import ForumArticle


@admin.register(ForumArticle)
class ForumArticleAdmin(ModelAdmin):
    list_display = ("title", "is_published", "published_at", "updated_at")
    list_filter = ("is_published", "published_at")
    search_fields = ("title", "summary", "body")
    prepopulated_fields = {"slug": ("title",)}
    ordering = ("-published_at",)
    fieldsets = (
        (None, {"fields": ("title", "slug", "summary", "meta_description", "cover_image", "body", "is_published")}),
        ("Datas", {"fields": ("published_at", "created_at", "updated_at"), "classes": ("collapse",)}),
    )
    readonly_fields = ("created_at", "updated_at")
