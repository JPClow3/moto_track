from __future__ import annotations

from django.contrib.auth.hashers import check_password
from django.utils import timezone
from rest_framework import authentication, exceptions, permissions

from apps.core.models import ApiToken


class ApiTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Token"

    def authenticate(self, request):
        auth = request.headers.get("Authorization", "")
        prefix = f"{self.keyword} "
        if not auth.startswith(prefix):
            raise exceptions.AuthenticationFailed("Token ausente ou inválido.")

        raw_key = auth.removeprefix(prefix).strip()
        key_prefix = raw_key[:12] if len(raw_key) >= 12 else raw_key
        for token in ApiToken.objects.filter(is_active=True, key_prefix=key_prefix).select_related("owner"):
            if check_password(raw_key, token.key_hash):
                ApiToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())
                return token.owner, token
        raise exceptions.AuthenticationFailed("Token ausente ou inválido.")

    def authenticate_header(self, request):  # noqa: ARG002
        return self.keyword


class HasApiScope(permissions.BasePermission):
    def has_permission(self, request, view):
        scope = getattr(view, "required_scope", "")
        token = request.auth
        if token and scope and token.has_scope(scope):
            return True
        raise exceptions.PermissionDenied("Token sem permissão para este recurso.")
