import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.garage.models import Motorcycle

pytestmark = pytest.mark.security


class CSRFProtectionTests(TestCase):
    def test_login_post_without_csrf_is_rejected(self):
        from django.test import Client
        client = Client(enforce_csrf_checks=True)
        response = client.post(
            reverse("account_login"),
            {"login": "foo", "password": "bar"},
        )
        self.assertEqual(response.status_code, 403)


class XSSSanitizationTests(TestCase):
    def test_forum_article_escapes_script_in_summary(self):
        from apps.forum.models import ForumArticle
        article = ForumArticle.objects.create(
            title="XSS",
            slug="xss-sec",
            summary='<script>alert(1)</script>Texto',
            body="Corpo",
            is_published=True,
        )
        response = self.client.get(reverse("blog:detail", args=[article.slug]))
        self.assertNotContains(response, "<script>alert(1)</script>")


class SQLInjectionTests(TestCase):
    def test_api_search_does_not_crash_on_quote(self):
        user = get_user_model().objects.create_user(username="sql", email="sql@example.com", password="Str0ngP@ss!")
        self.client.force_login(user)
        response = self.client.get("/api/v1/search/", {"q": "' OR '1'='1"})
        self.assertIn(response.status_code, [200, 400, 404])


class IDORTests(TestCase):
    def test_user_cannot_access_other_user_motorcycle_update(self):
        user_a = get_user_model().objects.create_user(username="a", email="a@example.com", password="Str0ngP@ss!")
        user_b = get_user_model().objects.create_user(username="b", email="b@example.com", password="Str0ngP@ss!")
        moto = Motorcycle.objects.create(owner=user_b, name="B", brand="Honda", model="CB", year=2024)
        self.client.force_login(user_a)
        response = self.client.get(reverse("garage:update", args=[moto.pk]))
        self.assertEqual(response.status_code, 404)
