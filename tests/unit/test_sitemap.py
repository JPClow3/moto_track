from django.test import TestCase, override_settings
from django.urls import reverse

from apps.forum.models import ForumArticle
from config.sitemaps import StaticViewSitemap


class SitemapTests(TestCase):
    def test_sitemap_uses_existing_url_names(self):
        sitemap = StaticViewSitemap()

        for item in sitemap.items():
            location = sitemap.location(item)
            self.assertTrue(
                location.startswith("/"),
                f"Location {location!r} should start with /",
            )
        self.assertIn("landing", sitemap.items())
        self.assertIn("privacy_policy", sitemap.items())
        self.assertIn("terms_of_service", sitemap.items())
        self.assertNotIn("account_login", sitemap.items())
        self.assertNotIn("account_signup", sitemap.items())

    def test_robots_uses_request_host_for_sitemap(self):
        response = self.client.get(reverse("robots_txt"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sitemap: http://testserver/sitemap.xml")

    def test_sitemap_uses_request_host_instead_of_default_site_record(self):
        response = self.client.get(reverse("django.contrib.sitemaps.views.sitemap"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "http://testserver/")
        self.assertNotContains(response, "http://testserver/accounts/login/")
        self.assertNotContains(response, "https://example.com/")

    @override_settings(SITE_DOMAIN="mototrack.app")
    def test_sitemap_prefers_configured_site_domain(self):
        response = self.client.get(reverse("django.contrib.sitemaps.views.sitemap"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "http://mototrack.app/")
        self.assertNotContains(response, "http://mototrack.app/accounts/login/")

    def test_sitemap_includes_roadmap(self):
        response = self.client.get(reverse("django.contrib.sitemaps.views.sitemap"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "/roadmap/")

    def test_sitemap_includes_forum_entries(self):
        ForumArticle.objects.create(
            title="Guia de troca de oleo",
            slug="guia-troca-oleo",
            summary="Resumo",
            body="Conteudo",
            is_published=True,
        )

        response = self.client.get(reverse("django.contrib.sitemaps.views.sitemap"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "/blog/")
        self.assertContains(response, "/blog/guia-troca-oleo/")
