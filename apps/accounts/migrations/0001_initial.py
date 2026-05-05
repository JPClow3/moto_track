# Generated manually for UserPreference model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("theme", models.CharField(choices=[("system", "Sistema"), ("dark", "Escuro"), ("light", "Claro")], default="system", max_length=10)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="preference", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "accounts_user_preference",
            },
        ),
    ]
