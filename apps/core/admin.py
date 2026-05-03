from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from django.contrib import admin
from django.contrib.auth.models import Group
from django.db import OperationalError, ProgrammingError
from unfold.admin import ModelAdmin

from apps.core.models import SiteSettings


class UserScopedAdmin(ModelAdmin):
    owner_lookup = "owner"
    foreign_key_scopes = {}
    many_to_many_scopes = {}

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(**{self.owner_lookup: request.user})

    def save_model(self, request, obj, form, change):
        if hasattr(obj, "owner_id") and not obj.owner_id:
            obj.owner = request.user
        super().save_model(request, obj, form, change)

    def _resolve_scoped_queryset(self, scope, user):
        return scope(user) if callable(scope) else scope

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if not request.user.is_superuser and db_field.name in self.foreign_key_scopes:
            kwargs["queryset"] = self._resolve_scoped_queryset(self.foreign_key_scopes[db_field.name], request.user)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if not request.user.is_superuser and db_field.name in self.many_to_many_scopes:
            kwargs["queryset"] = self._resolve_scoped_queryset(self.many_to_many_scopes[db_field.name], request.user)
        return super().formfield_for_manytomany(db_field, request, **kwargs)


def _safe_unregister(model) -> None:
    try:
        admin.site.unregister(model)
    except admin.sites.NotRegistered:
        pass


for _model in (Group, SocialAccount, SocialApp, SocialToken):
    _safe_unregister(_model)


@admin.register(SiteSettings)
class SiteSettingsAdmin(ModelAdmin):
    fieldsets = (
        ("Empresa", {"fields": ("company_name", "cnpj")}),
        ("Contato / Suporte", {"fields": ("support_email", "support_phone", "support_whatsapp")}),
        ("Endereço", {"fields": ("address_street", "address_city", "address_state", "address_zip")}),
        ("LGPD / DPO", {"fields": ("dpo_name", "dpo_email")}),
        ("Datas de atualização dos documentos legais", {"fields": (
            "terms_last_updated", "privacy_last_updated", "lgpd_last_updated", "cancellation_last_updated",
        )}),
    )

    def has_add_permission(self, request):
        try:
            return not SiteSettings.objects.exists()
        except (OperationalError, ProgrammingError):
            return True

    def has_delete_permission(self, request, obj=None):
        return False
