from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionprofile",
            name="trial_will_end_notified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="subscriptionprofile",
            name="next_invoice_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="subscriptionprofile",
            name="next_invoice_amount_cents",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="subscriptionprofile",
            name="next_invoice_currency",
            field=models.CharField(blank=True, default="", max_length=8),
        ),
    ]
