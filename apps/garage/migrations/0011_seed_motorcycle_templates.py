from django.db import migrations


def seed_templates(apps, schema_editor):
    from apps.garage.catalog_seed import seed_motorcycle_templates

    seed_motorcycle_templates(
        apps.get_model("garage", "MotorcycleTemplate"),
        apps.get_model("garage", "MotorcycleTemplateSpec"),
        apps.get_model("garage", "MotorcycleTemplateMaintenanceInterval"),
    )


class Migration(migrations.Migration):
    dependencies = [
        ("garage", "0010_motorcyclespec_consumption_avg_km_l_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_templates, migrations.RunPython.noop),
    ]
