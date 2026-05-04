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
            name="SubscriptionProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("plan", models.CharField(choices=[("free", "Free"), ("pro", "Pro")], default="free", max_length=16)),
                ("billing_interval", models.CharField(blank=True, choices=[("monthly", "Mensal"), ("yearly", "Anual")], default="", max_length=16)),
                ("stripe_customer_id", models.CharField(blank=True, db_index=True, default="", max_length=120)),
                ("stripe_subscription_id", models.CharField(blank=True, db_index=True, default="", max_length=120)),
                ("stripe_subscription_status", models.CharField(blank=True, default="", max_length=40)),
                ("stripe_price_id", models.CharField(blank=True, default="", max_length=120)),
                ("current_period_end", models.DateTimeField(blank=True, null=True)),
                ("cancel_at_period_end", models.BooleanField(default=False)),
                ("grace_until", models.DateTimeField(blank=True, null=True)),
                ("latest_invoice_url", models.URLField(blank=True, default="", max_length=500)),
                ("latest_receipt_url", models.URLField(blank=True, default="", max_length=500)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="subscription_profile", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["user__username"]},
        ),
        migrations.CreateModel(
            name="BillingEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("stripe_event_id", models.CharField(max_length=120, unique=True)),
                ("event_type", models.CharField(max_length=120)),
                ("payload", models.JSONField(default=dict)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("processing_error", models.TextField(blank=True, default="")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AccountDataRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("request_type", models.CharField(choices=[("export", "Exportacao"), ("deletion", "Exclusao")], max_length=16)),
                ("status", models.CharField(choices=[("open", "Aberto"), ("done", "Concluido"), ("rejected", "Rejeitado")], default="open", max_length=16)),
                ("notes", models.TextField(blank=True, default="")),
                ("fulfilled_at", models.DateTimeField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="data_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
