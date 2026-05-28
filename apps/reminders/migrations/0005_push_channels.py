from django.db import migrations, models


def copy_aggregate_to_email_channel(apps, schema_editor):
    Reminder = apps.get_model("reminders", "Reminder")
    Reminder.objects.filter(last_notified_at__isnull=False, last_email_notified_at__isnull=True).update(
        last_email_notified_at=models.F("last_notified_at")
    )


def clear_email_channel(apps, schema_editor):
    Reminder = apps.get_model("reminders", "Reminder")
    Reminder.objects.update(last_email_notified_at=None)


class Migration(migrations.Migration):
    dependencies = [
        ("reminders", "0004_reminder_reminder_moto_active_date_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="reminder",
            name="last_email_notified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reminder",
            name="last_push_notified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reminder",
            name="send_push",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(copy_aggregate_to_email_channel, clear_email_channel),
    ]
