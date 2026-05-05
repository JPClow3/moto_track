from django.test import TestCase
from django.urls import reverse


class PublicUiShellTests(TestCase):
    def test_public_and_auth_pages_render_theme_logo_markup(self):
        route_names = [
            "landing",
            "pricing",
            "account_login",
            "account_signup",
            "privacy_policy",
            "terms_of_service",
        ]

        for route_name in route_names:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, "data-theme-logo")
                self.assertContains(response, "moto-track-logo-horizontal-light.svg")
                self.assertContains(response, "moto-track-logo-horizontal-dark.svg")

    def test_legal_pages_do_not_render_auth_card_or_auth_fields(self):
        route_names = [
            "privacy_policy",
            "terms_of_service",
            "lgpd",
            "cancellation_policy",
        ]

        for route_name in route_names:
            with self.subTest(route=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, 'class="legal-document"')
                self.assertNotContains(response, "Bem-vindo de volta")
                self.assertNotContains(response, 'name="login"')
                self.assertNotContains(response, 'type="password"')

    def test_auth_pages_keep_auth_fields(self):
        login_response = self.client.get(reverse("account_login"))
        self.assertEqual(login_response.status_code, 200)
        self.assertContains(login_response, "Bem-vindo de volta")
        self.assertContains(login_response, 'name="login"')
        self.assertContains(login_response, 'type="password"')

        signup_response = self.client.get(reverse("account_signup"))
        self.assertEqual(signup_response.status_code, 200)
        self.assertContains(signup_response, "Crie sua conta Moto Track")
        self.assertContains(signup_response, 'name="email"')
        self.assertContains(signup_response, 'name="password1"')
