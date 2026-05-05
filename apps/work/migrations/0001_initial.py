from decimal import Decimal

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
            name="ProfessionalCostSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("maintenance_reserve_per_km", models.DecimalField(decimal_places=3, default=Decimal("0.120"), max_digits=8)),
                ("depreciation_per_km", models.DecimalField(decimal_places=3, default=Decimal("0.000"), max_digits=8)),
                ("fixed_daily_cost", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10)),
                ("motorcycle", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="professional_cost_settings", to="garage.motorcycle")),
            ],
            options={"verbose_name": "Configuracao profissional", "verbose_name_plural": "Configuracoes profissionais"},
        ),
        migrations.CreateModel(
            name="WorkSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("work_date", models.DateField()),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("odometer_start_km", models.PositiveIntegerField()),
                ("odometer_end_km", models.PositiveIntegerField()),
                ("gross_income", models.DecimalField(decimal_places=2, max_digits=10)),
                ("tips", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10)),
                ("deliveries_count", models.PositiveSmallIntegerField(default=0)),
                ("platform_source", models.CharField(choices=[("ifood", "iFood"), ("uber", "Uber"), ("99", "99"), ("loggi", "Loggi"), ("private", "Particular"), ("mototaxi", "Mototaxi"), ("other", "Outro")], default="other", max_length=24)),
                ("payment_method", models.CharField(choices=[("pix", "Pix"), ("cash", "Dinheiro"), ("card", "Cartao"), ("mixed", "Misto"), ("other", "Outro")], default="pix", max_length=16)),
                ("notes", models.TextField(blank=True, default="")),
                ("motorcycle", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="work_sessions", to="garage.motorcycle")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="work_sessions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-work_date", "-started_at", "-created_at"],
                "indexes": [
                    models.Index(fields=["owner", "work_date"], name="work_owner_date_idx"),
                    models.Index(fields=["motorcycle", "work_date"], name="work_moto_date_idx"),
                ],
            },
        ),
    ]
