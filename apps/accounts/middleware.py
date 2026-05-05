from __future__ import annotations

from django.shortcuts import redirect
from django.urls import reverse

from apps.accounts.verification import user_needs_email_verification


class EmailVerificationRequiredMiddleware:
    PUBLIC_EXACT_PATHS = {
        "/",
        "/precos/",
        "/politica/",
        "/termos/",
        "/lgpd/",
        "/cancelamento/",
        "/roadmap/",
        "/manifest.webmanifest",
        "/sw.js",
        "/offline/",
        "/sitemap.xml",
        "/robots.txt",
        "/api/pwa/status/",
        "/api/theme/",
    }
    PUBLIC_PREFIXES = (
        "/accounts/",
        "/blog/",
        "/forum/",
        "/static/",
        "/media/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if user_needs_email_verification(request.user) and not self._is_public_path(request.path_info):
            return redirect(reverse("account_email_verification_sent"))
        return self.get_response(request)

    def _is_public_path(self, path: str) -> bool:
        if path in self.PUBLIC_EXACT_PATHS:
            return True
        return any(path.startswith(prefix) for prefix in self.PUBLIC_PREFIXES)
