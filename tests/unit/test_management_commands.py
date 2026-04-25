import csv
import io
import os
import tempfile
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.garage.models import Motorcycle


class CreateAdminCommandTests(TestCase):
    def test_create_admin_with_args(self):
        out = io.StringIO()
        call_command("createadmin", "--username", "cmdadmin", "--password", "secret12345", "--email", "cmd@example.com", stdout=out)
        self.assertIn("created", out.getvalue())
        user = get_user_model().objects.get(username="cmdadmin")
        self.assertTrue(user.is_superuser)
        self.assertEqual(user.email, "cmd@example.com")

    def test_create_admin_updates_existing(self):
        User = get_user_model()
        User.objects.create_user(username="cmdadmin2", email="old@example.com", password="oldpass")
        out = io.StringIO()
        call_command("createadmin", "--username", "cmdadmin2", "--password", "newpass12345", "--email", "new@example.com", stdout=out)
        self.assertIn("updated", out.getvalue())
        user = User.objects.get(username="cmdadmin2")
        self.assertTrue(user.check_password("newpass12345"))
        self.assertEqual(user.email, "new@example.com")

    def test_create_admin_empty_password_env_raises(self):
        with patch.dict(os.environ, {"DJANGO_CREATEADMIN_PASSWORD": "   "}):
            with self.assertRaises(CommandError):
                call_command("createadmin", "--username", "u")

    def test_create_admin_missing_username_raises(self):
        with patch("builtins.input", return_value=""):
            with self.assertRaises(CommandError):
                call_command("createadmin")


class EnsureAdminCommandTests(TestCase):
    def test_bootstrap_disabled_warns(self):
        out = io.StringIO()
        with patch.dict(os.environ, {}, clear=True):
            call_command("ensure_admin", stdout=out)
        self.assertIn("Bootstrap disabled", out.getvalue())

    def test_bootstrap_creates_admin(self):
        out = io.StringIO()
        env = {
            "DJANGO_BOOTSTRAP_ENABLE": "true",
            "DJANGO_BOOTSTRAP_ADMIN_USERNAME": "bootstrapadmin",
            "DJANGO_BOOTSTRAP_ADMIN_PASSWORD": "bootpass12345",
        }
        with patch.dict(os.environ, env):
            call_command("ensure_admin", stdout=out)
        self.assertIn("created", out.getvalue())
        user = get_user_model().objects.get(username="bootstrapadmin")
        self.assertTrue(user.check_password("bootpass12345"))

    def test_bootstrap_existing_user_no_password(self):
        User = get_user_model()
        User.objects.create_user(username="existingadmin", password="oldpass")
        out = io.StringIO()
        env = {
            "DJANGO_BOOTSTRAP_ENABLE": "true",
            "DJANGO_BOOTSTRAP_ADMIN_USERNAME": "existingadmin",
        }
        with patch.dict(os.environ, env):
            call_command("ensure_admin", stdout=out)
        self.assertIn("updated", out.getvalue())
        self.assertIn("keeping existing admin password", out.getvalue())


class SeedDemoDataCommandTests(TestCase):
    def test_seed_demo_data_idempotent(self):
        out = io.StringIO()
        call_command("seed_demo_data", stdout=out)
        self.assertIn("Demo data created", out.getvalue())
        # Second run should not crash
        out2 = io.StringIO()
        call_command("seed_demo_data", stdout=out2)
        self.assertIn("Demo data created", out2.getvalue())


class ImportFuelCsvCommandTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="fuel-cmd", email="fuel@example.com", password="pass12345")
        self.motorcycle = Motorcycle.objects.create(
            owner=self.user, name="Moto CMD", brand="Honda", model="CB", year=2024
        )

    def _make_csv(self, rows):
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=["date", "odometer_km", "liters", "total_price", "station_name"])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        buf.seek(0)
        return buf

    def test_import_valid_rows(self):
        buf = self._make_csv([
            {"date": "2024-01-01", "odometer_km": "1000", "liters": "10.0", "total_price": "70.00", "station_name": "Shell"},
            {"date": "2024-01-15", "odometer_km": "1200", "liters": "12.0", "total_price": "84.00", "station_name": "Ipiranga"},
        ])
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".csv", delete=False, newline="") as f:
            f.write(buf.getvalue())
            path = f.name
        try:
            out = io.StringIO()
            call_command("import_fuel_csv", "--file", path, "--user", "fuel@example.com", "--motorcycle", str(self.motorcycle.id), stdout=out)
            self.assertIn("Importados 2 registros", out.getvalue())
        finally:
            os.unlink(path)

    def test_dry_run(self):
        buf = self._make_csv([
            {"date": "2024-01-01", "odometer_km": "1000", "liters": "10.0", "total_price": "70.00", "station_name": "Shell"},
        ])
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".csv", delete=False, newline="") as f:
            f.write(buf.getvalue())
            path = f.name
        try:
            out = io.StringIO()
            call_command("import_fuel_csv", "--file", path, "--user", "fuel@example.com", "--motorcycle", str(self.motorcycle.id), "--dry-run", stdout=out)
            self.assertIn("MODO PREVIEW", out.getvalue())
            self.assertIn("Preview concluído", out.getvalue())
        finally:
            os.unlink(path)

    def test_import_missing_user_raises(self):
        buf = self._make_csv([{"date": "2024-01-01", "odometer_km": "1000", "liters": "10.0", "total_price": "70.00", "station_name": "Shell"}])
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".csv", delete=False, newline="") as f:
            f.write(buf.getvalue())
            path = f.name
        try:
            with self.assertRaises(CommandError):
                call_command("import_fuel_csv", "--file", path, "--user", "nosuch@example.com", "--motorcycle", str(self.motorcycle.id))
        finally:
            os.unlink(path)

    def test_import_invalid_row_skipped(self):
        buf = self._make_csv([
            {"date": "bad-date", "odometer_km": "abc", "liters": "10.0", "total_price": "70.00", "station_name": "Shell"},
        ])
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".csv", delete=False, newline="") as f:
            f.write(buf.getvalue())
            path = f.name
        try:
            out = io.StringIO()
            call_command("import_fuel_csv", "--file", path, "--user", "fuel@example.com", "--motorcycle", str(self.motorcycle.id), stdout=out)
            self.assertIn("0 registros", out.getvalue())
            self.assertIn("erros", out.getvalue())
        finally:
            os.unlink(path)

    def test_import_duplicate_skipped(self):
        buf = self._make_csv([
            {"date": "2024-01-01", "odometer_km": "1000", "liters": "10.0", "total_price": "70.00", "station_name": "Shell"},
            {"date": "2024-01-01", "odometer_km": "1000", "liters": "10.0", "total_price": "70.00", "station_name": "Shell"},
        ])
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".csv", delete=False, newline="") as f:
            f.write(buf.getvalue())
            path = f.name
        try:
            out = io.StringIO()
            call_command("import_fuel_csv", "--file", path, "--user", "fuel@example.com", "--motorcycle", str(self.motorcycle.id), stdout=out)
            self.assertIn("Importados 1 registros", out.getvalue())
            self.assertIn("1 erros", out.getvalue())
        finally:
            os.unlink(path)
