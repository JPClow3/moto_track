
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.fuel.models import FuelRecord
from apps.garage.models import Motorcycle
from apps.maintenance.models import MaintenanceRecord, MaintenanceType
from apps.reports.services import timeline_events


class AnonymousToDashboardJourneyTests(TestCase):
    def test_anonymous_user_sees_landing_and_login_links(self):
        response = self.client.get(reverse("landing"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("login"))


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class FullUserLifecycleTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="lifecycle",
            email="lifecycle@example.com",
            password="Str0ngP@ss!",
            is_active=True,
        )

    def test_login_dashboard_and_crud_flow(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("garage:create"),
            {
                "name": "CB500",
                "brand": "Honda",
                "model": "CB",
                "year": 2022,
                "license_plate": "ABC1234",
                "current_odometer_km": 1000,
            },
        )
        self.assertEqual(response.status_code, 302)
        motorcycle = Motorcycle.objects.get(owner=self.user, name="CB500")

        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            reverse("fuel:quick_create"),
            {
                "motorcycle": motorcycle.pk,
                "date": "2026-04-15",
                "odometer_km": 1500,
                "liters": "10.000",
                "total_price_0": "80.00",
                "total_price_1": "BRL",
                "price_per_liter_0": "8.000",
                "price_per_liter_1": "BRL",
                "fuel_type": "gasoline",
                "tank_full": "on",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(FuelRecord.objects.filter(motorcycle=motorcycle).count(), 1)

        response = self.client.post(
            reverse("maintenance:quick_create"),
            {
                "motorcycle": motorcycle.pk,
                "maintenance_type": MaintenanceType.OIL_CHANGE,
                "date": "2026-04-10",
                "odometer_km": 1200,
                "cost_0": "120.00",
                "cost_1": "BRL",
                "description": "Troca de oleo",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(MaintenanceRecord.objects.filter(motorcycle=motorcycle).count(), 1)

        events = timeline_events(user=self.user, motorcycle=motorcycle)
        self.assertTrue(any(e.source == "fuel" for e in events))
        self.assertTrue(any(e.source == "maintenance" for e in events))

        response = self.client.post(reverse("logout"))
        self.assertEqual(response.status_code, 302)
        response = self.client.get(reverse("dashboard"))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('dashboard')}")
