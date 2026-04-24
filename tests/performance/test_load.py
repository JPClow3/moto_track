import threading
from http.client import HTTPConnection

from django.contrib.auth import get_user_model
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.test import override_settings
from django.urls import reverse

from apps.garage.models import Motorcycle


@override_settings(ALLOWED_HOSTS=["*"])
class InProcessLoadTests(StaticLiveServerTestCase):
    fixtures = []

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.host = cls.live_server_url.replace("http://", "").replace("https://", "").rstrip("/")

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="load", email="load@example.com", password="Str0ngP@ss!")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Load", brand="Honda", model="CB", year=2024, current_odometer_km=1000
        )

    def _request(self, method, path, headers=None, body=None):
        conn = HTTPConnection(self.host)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        status = response.status
        conn.close()
        return status

    def test_landing_serves_under_load(self):
        path = reverse("landing")
        errors = []
        times = []

        def worker():
            import time
            start = time.perf_counter()
            try:
                status = self._request("GET", path)
                if status != 200:
                    errors.append(status)
            except Exception as exc:
                errors.append(str(exc))
            times.append(time.perf_counter() - start)

        threads = [threading.Thread(target=worker) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        self.assertEqual(errors, [])
        self.assertLess(max(times), 5.0, f"Slowest request took {max(times):.2f}s")

    def test_dashboard_redirects_anon_under_load(self):
        path = reverse("dashboard")
        errors = []

        def worker():
            try:
                status = self._request("GET", path)
                if status != 302:
                    errors.append(status)
            except Exception as exc:
                errors.append(str(exc))

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        self.assertEqual(errors, [])
