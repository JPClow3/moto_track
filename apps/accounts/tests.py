from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


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

    def test_login_with_valid_credentials(self):
        logged_in = self.client.login(username=self.user.username, password=self.password)
        self.assertTrue(logged_in)

    def test_logout_redirects_to_login(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse("logout"))
        self.assertEqual(response.status_code, 302)
