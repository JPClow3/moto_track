from smtplib import SMTPDataError
from unittest.mock import patch

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.internal.flows.login import perform_login
from allauth.account.models import EmailAddress, Login
from allauth.core import context
from allauth.socialaccount.adapter import get_adapter as get_socialaccount_adapter
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialLogin, SocialToken
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages.middleware import MessageMiddleware
from django.contrib.sessions.middleware import SessionMiddleware
from django.core import mail
from django.test import Client, RequestFactory, TestCase, override_settings
from django.urls import reverse

from apps.accounts.adapters import MotoAccountAdapter
from apps.core.models import PushSubscription


class AccountsSmokeTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.password = "pass12345"
        self.user = User.objects.create_user(
            username="accounts-user", email="accounts@example.com", password=self.password
        )

    def _request_with_session_and_messages(self, path="/accounts/google/login/callback/"):
        request = RequestFactory().get(path)
        request.user = AnonymousUser()
        SessionMiddleware(lambda req: None).process_request(request)
        MessageMiddleware(lambda req: None).process_request(request)
        return request

    def test_login_page_loads(self):
        response = self.client.get(reverse("login"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-theme="system"')
        self.assertContains(response, "data-theme-toggle")
        self.assertContains(response, reverse("manifest"))

    def test_account_login_accepts_email_and_redirects(self):
        User = get_user_model()
        user = User.objects.create_user(username="testuser", email="email@example.com", password="pass12345")
        user.emailaddress_set.create(email="email@example.com", primary=True, verified=True)
        response = self.client.post(
            reverse("account_login"),
            {"login": "email@example.com", "password": "pass12345"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("dashboard"), response["Location"])

    def test_login_with_valid_credentials(self):
        logged_in = self.client.login(username=self.user.username, password=self.password)
        self.assertTrue(logged_in)

    def test_logout_redirects_to_login(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("logout"))
        self.assertEqual(response.status_code, 302)

    def test_signup_requires_terms_acceptance(self):
        response = self.client.post(
            reverse("account_signup"),
            {
                "email": "new-user@example.com",
                "username": "new-user",
                "password1": "strong-pass-12345",
                "password2": "strong-pass-12345",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("accept_terms", response.context["form"].errors)

    @override_settings(
        ACCOUNT_EMAIL_VERIFICATION="mandatory",
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    )
    def test_signup_with_terms_sends_verification_email(self):
        response = self.client.post(
            reverse("account_signup"),
            {
                "email": "verified-flow@example.com",
                "username": "verified-flow",
                "password1": "strong-pass-12345",
                "password2": "strong-pass-12345",
                "accept_terms": "on",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verified-flow@example.com", mail.outbox[0].to)

    def test_confirmation_email_delivery_error_does_not_abort_flow(self):
        class EmailConfirmation:
            email_address = type("EmailAddressStub", (), {"email": "smtp-failure@example.com"})()

        adapter = MotoAccountAdapter()
        with patch.object(
            DefaultAccountAdapter,
            "send_confirmation_mail",
            side_effect=SMTPDataError(554, b"delivery failed"),
        ) as send_confirmation_mail:
            result = adapter.send_confirmation_mail(None, EmailConfirmation(), signup=True)

        self.assertIsNone(result)
        send_confirmation_mail.assert_called_once()

    @override_settings(ACCOUNT_EMAIL_VERIFICATION="mandatory")
    def test_unverified_user_cannot_enter_private_app_routes(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="needs-verification",
            email="needs-verification@example.com",
            password="pass12345",
        )
        EmailAddress.objects.create(
            user=user,
            email="needs-verification@example.com",
            primary=True,
            verified=False,
        )
        self.client.force_login(user)

        landing_response = self.client.get(reverse("landing"))
        private_response = self.client.get(reverse("dashboard"))
        public_response = self.client.get(reverse("blog:list"))

        self.assertEqual(landing_response.status_code, 200)
        self.assertContains(landing_response, "Verificar e-mail")
        self.assertEqual(private_response.status_code, 302)
        self.assertEqual(private_response["Location"], reverse("account_email_verification_sent"))
        self.assertEqual(public_response.status_code, 200)
        self.assertContains(public_response, "Guias Moto Track")
        self.assertNotContains(public_response, 'id="quick-add-trigger"')

    def test_google_login_entrypoint_does_not_500(self):
        client = Client(raise_request_exception=False)

        response = client.get("/accounts/google/login/")

        self.assertNotEqual(response.status_code, 500)

    def test_google_callback_error_redirects_to_login_instead_of_500(self):
        client = Client(raise_request_exception=False)

        response = client.get("/accounts/google/login/callback/?error=access_denied")

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], reverse("account_login"))

    @override_settings(ACCOUNT_EMAIL_VERIFICATION="mandatory")
    def test_google_signup_email_delivery_failure_does_not_abort_login_flow(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="smtp-google-user",
            email="smtp-google@example.com",
            password="pass12345",
        )
        EmailAddress.objects.create(
            user=user,
            email="smtp-google@example.com",
            primary=True,
            verified=False,
        )
        request = self._request_with_session_and_messages()
        login = Login(user=user, signup=True)
        ses_rejection = SMTPDataError(
            554,
            b"Email address is not verified. The following identities failed the check: no-reply@motoapp.local",
        )

        with (
            patch("apps.accounts.adapters.MotoAccountAdapter.send_mail", side_effect=ses_rejection),
            self.assertLogs("apps.accounts.adapters", level="WARNING") as logs,
        ):
            with context.request_context(request):
                response = perform_login(request, login)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], reverse("account_email_verification_sent"))
        self.assertIn("Email verification delivery failed", logs.output[0])

    def test_google_login_can_match_existing_verified_email(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="existing-google-user",
            email="existing-google@example.com",
            password="pass12345",
        )
        EmailAddress.objects.create(
            user=user,
            email="existing-google@example.com",
            primary=True,
            verified=True,
        )
        social_user = User(username="existing-google", email="existing-google@example.com")
        social_login = SocialLogin(
            user=social_user,
            account=SocialAccount(provider="google", uid="google-uid-123", user=social_user),
            provider=get_socialaccount_adapter().get_provider(None, provider="google"),
        )
        social_login.email_addresses = [
            EmailAddress(email="existing-google@example.com", primary=True, verified=True),
        ]

        social_login.lookup()

        self.assertEqual(social_login.user, user)

    def test_login_page_offers_both_auth_methods(self):
        response = self.client.get(reverse("account_login"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Continuar com Google")
        # Subtitle that surfaces the two auth methods in one short line.
        self.assertContains(response, "E-mail e senha, ou Google.")

    def test_login_handles_garbage_payload_without_500(self):
        client = Client(raise_request_exception=False)
        response = client.post(
            reverse("account_login"),
            {"login": "<script>alert(1)</script>" * 30, "password": "x"},
        )

        self.assertNotEqual(response.status_code, 500)

    def test_setup_and_operational_models_are_not_in_admin(self):
        admin.autodiscover()

        for model in (SocialAccount, SocialApp, SocialToken, PushSubscription):
            with self.subTest(model=model.__name__):
                self.assertNotIn(model, admin.site._registry)
