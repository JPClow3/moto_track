import os
import secrets
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.garage.models import Motorcycle, MotorcycleSpec


class Command(BaseCommand):
    help = "Ensure a superuser exists with stable credentials."

    def handle(self, *args, **options):
        if os.getenv("DJANGO_BOOTSTRAP_ENABLE", "").lower() not in {"1", "true", "yes"}:
            self.stdout.write(
                self.style.WARNING("Bootstrap disabled (set DJANGO_BOOTSTRAP_ENABLE=true to run ensure_admin).")
            )
            return

        username = os.getenv("DJANGO_BOOTSTRAP_ADMIN_USERNAME", "admin")
        password = os.getenv("DJANGO_BOOTSTRAP_ADMIN_PASSWORD")
        email = os.getenv("DJANGO_BOOTSTRAP_ADMIN_EMAIL", "admin@example.com")

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_active": True,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        user.email = email
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True

        # Only rotate password when explicitly provided or while creating the bootstrap user.
        if password:
            user.set_password(password)
        elif created:
            generated_password = secrets.token_urlsafe(24)
            user.set_password(generated_password)
            self.stdout.write(self.style.WARNING(f"Using generated random password for admin: {generated_password}"))
        else:
            self.stdout.write(
                self.style.WARNING(
                    "DJANGO_BOOTSTRAP_ADMIN_PASSWORD not set; keeping existing admin password unchanged."
                )
            )

        user.save()

        motorcycle, motorcycle_created = Motorcycle.objects.get_or_create(
            owner=user,
            name="KTM 200 Duke 2017",
            defaults={
                "brand": "KTM",
                "model": "200 Duke",
                "year": 2017,
                "license_plate": "",
            },
        )
        if not motorcycle_created:
            motorcycle.brand = "KTM"
            motorcycle.model = "200 Duke"
            motorcycle.year = 2017
            motorcycle.save(update_fields=["brand", "model", "year"])

        spec_defaults = {
            "fuel_tank_capacity_l": Decimal("11.00"),
            "fuel_type_recommendation": "Gasolina",
            "oil_capacity_l": Decimal("1.50"),
            "tire_size_front": "110/70R17",
            "tire_size_rear": "150/60R17",
            "chain_size": "Cadeia",
            "manual_reference": "A2 | 26HP@10000rpm | torque@8000rpm | bore 72mm | stroke 49mm",
        }
        spec, spec_created = MotorcycleSpec.objects.get_or_create(
            motorcycle=motorcycle,
            defaults=spec_defaults,
        )
        if not spec_created:
            for field, value in spec_defaults.items():
                setattr(spec, field, value)
            spec.save(update_fields=list(spec_defaults.keys()))

        action = "created" if created else "updated"
        bike_action = "created" if motorcycle_created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Admin user {action}: {username}"))
        self.stdout.write(self.style.SUCCESS(f"First bike {bike_action}: {motorcycle.name}"))
