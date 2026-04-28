from __future__ import annotations

from allauth.account.adapter import DefaultAccountAdapter
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse


class MotoAccountAdapter(DefaultAccountAdapter):
    def save_user(self, request, user, form, commit=True):
        user = super().save_user(request, user, form, commit=commit)
        if (user.is_staff or getattr(user, "is_superuser", False)) and user.email:
            from allauth.account.models import EmailAddress

            email_address, _ = EmailAddress.objects.update_or_create(
                user=user,
                email=user.email,
                defaults={"primary": True, "verified": True},
            )
        return user


class MotoSocialAccountAdapter(DefaultSocialAccountAdapter):
    def on_authentication_error(self, request, provider, error=None, exception=None, extra_context=None):
        provider_name = getattr(provider, "name", "provedor externo")
        messages.error(
            request,
            f"Nao foi possivel concluir o acesso com {provider_name}. Tente novamente ou use e-mail e senha.",
        )
        raise ImmediateHttpResponse(redirect(reverse("account_login")))
