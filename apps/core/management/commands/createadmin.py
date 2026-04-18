import getpass
import os
import sys

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError


class Command(BaseCommand):
    help = "Create a superuser without requiring an email prompt."

    def add_arguments(self, parser):
        parser.add_argument("--username", default=None)
        parser.add_argument("--email", default=None)
        parser.add_argument("--password", default=None)

    def handle(self, *args, **options):
        user_model = get_user_model()

        username = options["username"] or input("Username: ").strip()
        if not username:
            raise CommandError("Username is required.")

        email = (options["email"] or "").strip() or "admin@invalid.local"

        password = options["password"]
        if password is None:
            password = os.getenv("DJANGO_CREATEADMIN_PASSWORD")

        if password is not None and not str(password).strip():
            raise CommandError("Password cannot be empty when using --password or DJANGO_CREATEADMIN_PASSWORD.")

        if password is None:
            if not sys.stdin.isatty():
                raise CommandError(
                    "No TTY for password input. Use: python manage.py createadmin "
                    "--username USER --password PASS (or set DJANGO_CREATEADMIN_PASSWORD) [--email EMAIL]"
                )
            password = getpass.getpass("Password: ")
            password2 = getpass.getpass("Password (again): ")
            if password != password2:
                raise CommandError("Passwords do not match.")
            if not password:
                raise CommandError("Password is required.")

        try:
            user, created = user_model.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "is_active": True,
                    "is_staff": True,
                    "is_superuser": True,
                },
            )
        except IntegrityError as exc:
            raise CommandError(
                "Não foi possível criar o usuário (restrição de unicidade?). Tente outro usuário ou e-mail."
            ) from exc

        user.email = email
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        action = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Admin user {action}: {username}"))
