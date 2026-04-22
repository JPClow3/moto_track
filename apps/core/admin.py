from unfold.admin import ModelAdmin


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

from django.contrib import admin

from .models import PushSubscription


@admin.register(PushSubscription)
class PushSubscriptionAdmin(UserScopedAdmin):
    list_display = ("owner", "endpoint", "created_at")
    search_fields = ("owner__username", "owner__email", "endpoint")
