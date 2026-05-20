from __future__ import annotations

import logging
from smtplib import SMTPException

from allauth.account.adapter import DefaultAccountAdapter
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib import messages
from django.shortcuts import redirect
from django.urls import reverse

from apps.core.metrics import signups_total

logger = logging.getLogger(__name__)


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
        # SocialAccountAdapter.save_user (below) increments the counter for
        # OAuth signups — it calls super() into here, so we can't tell which
        # path we're on reliably (AUTO_SIGNUP passes form=None). The social
        # adapter records its outcome AFTER super() returns and tags
        # method="google". For everything else this is a password signup.
        if not getattr(request, "_moto_signup_counted", False):
            signups_total.labels(method="password").inc()
        return user

    def send_confirmation_mail(self, request, emailconfirmation, signup):
        try:
            return super().send_confirmation_mail(request, emailconfirmation, signup)
        except SMTPException:
            logger.warning(
                "Email verification delivery failed; continuing auth flow. email=%s signup=%s",
                emailconfirmation.email_address.email,
                signup,
                exc_info=True,
            )


class MotoSocialAccountAdapter(DefaultSocialAccountAdapter):
    def save_user(self, request, sociallogin, form=None):
        # Mark the request BEFORE super() so the account adapter (which super()
        # routes into) skips its "password" counter and lets us own the label.
        if request is not None:
            request._moto_signup_counted = True
        user = super().save_user(request, sociallogin, form=form)
        provider_id = getattr(sociallogin, "account", None)
        provider = getattr(provider_id, "provider", "social") or "social"
        signups_total.labels(method=str(provider)).inc()
        return user

    def on_authentication_error(self, request, provider, error=None, exception=None, extra_context=None):
        provider_name = getattr(provider, "name", "provedor externo")
        messages.error(
            request,
            f"Nao foi possivel concluir o acesso com {provider_name}. Tente novamente ou use e-mail e senha.",
        )
        raise ImmediateHttpResponse(redirect(reverse("account_login")))
