from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from apps.core.models import PushSubscription


class AccountsSmokeTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.password = "pass12345"
        self.user = User.objects.create_user(
            username="accounts-user", email="accounts@example.com", password=self.password
        )

    def test_login_page_loads(self):
        response = self.client.get(reverse("login"))
        self.assertEqual(response.status_code, 200)

    def test_account_login_accepts_email_and_redirects(self):
        EmailAddress.objects.create(user=self.user, email=self.user.email, verified=True, primary=True)

        response = self.client.post(
            reverse("account_login"),
            {"login": self.user.email, "password": self.password},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/")

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

    def test_google_login_entrypoint_does_not_500(self):
        client = Client(raise_request_exception=False)

        response = client.get("/accounts/google/login/")

        self.assertNotEqual(response.status_code, 500)

    def test_setup_and_operational_models_are_not_in_admin(self):
        admin.autodiscover()

        for model in (SocialAccount, SocialApp, SocialToken, PushSubscription):
            with self.subTest(model=model.__name__):
                self.assertNotIn(model, admin.site._registry)
