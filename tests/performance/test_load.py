import threading
from http.client import HTTPConnection
from unittest import skipIf

from django.contrib.auth import get_user_model
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.db import connection
from django.test import override_settings
from django.urls import reverse

from apps.garage.models import Motorcycle


@override_settings(ALLOWED_HOSTS=["*"])
@skipIf(connection.vendor == "sqlite", "SQLite :memory: does not support concurrent threaded access")
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

    def test_concurrent_fuel_creates(self):
        from apps.fuel.models import FuelRecord
        errors = []

        def worker(i):
            try:
                # Each thread needs its own motorcycle to avoid odometer sequence conflicts
                from apps.garage.models import Motorcycle
                bike = Motorcycle.objects.create(
                    owner=self.user, name=f"Thread Bike {i}", brand="Honda", model="CB", year=2024, current_odometer_km=1000
                )
                FuelRecord.objects.create(
                    motorcycle=bike,
                    date=f"2026-07-{(i % 28) + 1:02d}",
                    odometer_km=2000 + i,
                    liters=10,
                    total_price=50,
                    price_per_liter=5,
                    fuel_type="gasoline"
                )
            except Exception as exc:
                errors.append(str(exc))

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(50)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        self.assertEqual(errors, [])
        self.assertEqual(FuelRecord.objects.count(), 50)

    def test_dashboard_heavy_load(self):
        # Create 200 fuel records
        from apps.fuel.models import FuelRecord
        records = [
            FuelRecord(
                motorcycle=self.motorcycle,
                date=f"2026-07-{(i % 28) + 1:02d}",
                odometer_km=3000 + i,
                liters=10,
                total_price=50,
                price_per_liter=5,
                fuel_type="gasoline"
            ) for i in range(200)
        ]
        FuelRecord.objects.bulk_create(records)

        # Test dashboard endpoint with logged in user using Django Client
        # (This is a heavy read test, we use the test client directly)
        from django.test import Client
        client = Client()
        client.force_login(self.user)
        
        errors = []
        import time
        times = []

        def worker():
            start = time.perf_counter()
            try:
                response = client.get(reverse("dashboard"))
                if response.status_code != 200:
                    errors.append(response.status_code)
            except Exception as exc:
                errors.append(str(exc))
            times.append(time.perf_counter() - start)

        # 20 concurrent dashboard reads
        threads = [threading.Thread(target=worker) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        self.assertEqual(errors, [])
        self.assertLess(max(times), 8.0, f"Slowest dashboard read took {max(times):.2f}s")

