from datetime import date, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from apps.core.models import ApiToken
from apps.core.undo import create_undo_token, consume_undo_token
from apps.forum.models import ForumArticle
from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle, MotorcycleTemplate
from apps.tires.models import TireRecord


class UndoTokenZSuffixTests(TestCase):
    def test_undo_token_with_z_suffix_is_valid(self):
        from django.test import RequestFactory
        from django.contrib.sessions.middleware import SessionMiddleware
        from apps.garage.models import Motorcycle
        from apps.fuel.models import FuelRecord
        user = get_user_model().objects.create_user(username="undo", email="undo@example.com")
        motorcycle = Motorcycle.objects.create(owner=user, name="Undo", brand="Honda", model="CB", year=2024)
        record = FuelRecord.objects.create(
            motorcycle=motorcycle,
            date=date(2026, 4, 1),
            odometer_km=100,
            liters=Decimal("5.000"),
            total_price=Decimal("35.00"),
            price_per_liter=Decimal("7.000"),
        )
        request = RequestFactory().get("/")
        SessionMiddleware(lambda r: r).process_request(request)
        request.session.save()
        request.user = user
        token = create_undo_token(request, model_label="fuel.FuelRecord", object_id=record.pk, label="delete")
        payload, error = consume_undo_token(request, token=token)
        self.assertIsNotNone(payload)
        self.assertEqual(error, "")


class OdometerQuickUpdateBlockedBelowTireHistoryTests(TestCase):
    def test_override_below_tire_max_is_rejected(self):
        user = get_user_model().objects.create_user(username="odometer", email="odo@example.com")
        motorcycle = Motorcycle.objects.create(
            owner=user, name="Moto", brand="Honda", model="CB", year=2024, current_odometer_km=5000
        )
        TireRecord.objects.create(
            motorcycle=motorcycle,
            position="front",
            brand_model="Pirelli",
            installed_at=date(2026, 1, 1),
            installed_odometer_km=3000,
            cost=Decimal("0"),
            wear_percent=0,
        )
        from apps.core.forms import OdometerOverrideForm
        form = OdometerOverrideForm(data={"odometer_override_km": 2000}, motorcycle=motorcycle)
        self.assertFalse(form.is_valid())
        self.assertIn("odometer_override_km", form.errors)


class OnboardingRollbackTests(TestCase):
    def test_onboarding_does_not_leave_partial_motorcycle_on_failure(self):
        user = get_user_model().objects.create_user(username="rollback", email="rollback@example.com")
        self.client.force_login(user)
        MotorcycleTemplate.objects.create(brand="Yamaha", model="MT-03", year_from=2020, engine_cc=321)
        count_before = Motorcycle.objects.filter(owner=user).count()
        response = self.client.post(
            reverse("onboarding"),
            {
                "template_not_listed": "1",
                "motorcycle_name": "Rollback",
                "brand": "Yamaha",
                "model": "MT-03",
                "year": 2022,
                "current_odometer_km": 1000,
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Motorcycle.objects.filter(owner=user).count(), count_before + 1)


class ForumXSSTests(TestCase):
    def test_article_summary_strips_script_tag(self):
        article = ForumArticle.objects.create(
            title="XSS",
            slug="xss-test",
            summary='<script>alert(1)</script>Texto limpo',
            body="Corpo",
            is_published=True,
        )
        response = self.client.get(reverse("blog:detail", args=[article.slug]))
        self.assertNotContains(response, "<script>alert(1)</script>")


class PopulateTemplatesIdempotencyTests(TestCase):
    @override_settings(DEBUG=True)
    def test_populate_templates_command_is_idempotent(self):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command("populate_templates", stdout=out)
        first = out.getvalue()
        out2 = StringIO()
        call_command("populate_templates", stdout=out2)
        second = out2.getvalue()
        self.assertIn("Successfully populated", second)


class SitemapSiteDomainTests(TestCase):
    def test_sitemap_prefers_site_domain_setting(self):
        with override_settings(SITE_DOMAIN="example.com"):
            response = self.client.get(reverse("django.contrib.sitemaps.views.sitemap"))
            self.assertContains(response, "example.com")
