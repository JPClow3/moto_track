import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("garage", "0011_seed_motorcycle_templates"),
    ]

    operations = [
        migrations.CreateModel(
            name="SaleReportShare",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("token_prefix", models.CharField(db_index=True, max_length=12)),
                ("expires_at", models.DateTimeField()),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("last_accessed_at", models.DateTimeField(blank=True, null=True)),
                ("access_count", models.PositiveIntegerField(default=0)),
                (
                    "motorcycle",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sale_report_shares", to="garage.motorcycle"),
                ),
                (
                    "owner",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sale_report_shares", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["owner", "motorcycle", "expires_at"], name="sale_share_owner_moto_exp_idx"),
                    models.Index(fields=["token_prefix"], name="sale_share_token_prefix_idx"),
                ],
            },
        ),
    ]
