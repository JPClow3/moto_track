from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("work", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="worksession",
            name="fuel_spent",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
