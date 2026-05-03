import os
import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


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
            user.set_password(secrets.token_urlsafe(24))
            self.stdout.write(
                self.style.WARNING(
                    "New admin: a random password was set and is not logged (avoid log leaks). "
                    f"Run `python manage.py changepassword {username}` on the host, "
                    "or set DJANGO_BOOTSTRAP_ADMIN_PASSWORD before bootstrap for a known password."
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "DJANGO_BOOTSTRAP_ADMIN_PASSWORD not set; keeping existing admin password unchanged."
                )
            )

        user.save()

        if user.email:
            from allauth.account.models import EmailAddress

            EmailAddress.objects.filter(user=user, primary=True).update(primary=False)
            EmailAddress.objects.update_or_create(
                user=user,
                email=user.email,
                defaults={"primary": True, "verified": True},
            )

        action = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Admin user {action}: {username}"))
