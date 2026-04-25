from __future__ import annotations

from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse


class MotoSocialAccountAdapter(DefaultSocialAccountAdapter):
    def on_authentication_error(self, request, provider, error=None, exception=None, extra_context=None):
        provider_name = getattr(provider, "name", "provedor externo")
        messages.error(
            request,
            f"Nao foi possivel concluir o acesso com {provider_name}. Tente novamente ou use e-mail e senha.",
        )
        raise ImmediateHttpResponse(redirect(reverse("account_login")))
