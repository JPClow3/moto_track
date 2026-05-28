from django.contrib import admin

from apps.core.admin import UserScopedAdmin

from .models import SaleReportShare


@admin.register(SaleReportShare)
class SaleReportShareAdmin(UserScopedAdmin):
    list_display = ("motorcycle", "owner", "token_prefix", "expires_at", "revoked_at", "access_count")
    list_filter = ("revoked_at", "expires_at")
    search_fields = ("motorcycle__name", "owner__username", "token_prefix")
    readonly_fields = ("token_hash", "token_prefix", "last_accessed_at", "access_count")
