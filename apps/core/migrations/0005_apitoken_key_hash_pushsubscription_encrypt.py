# Generated manually for ApiToken key hashing and PushSubscription encryption

from django.contrib.auth.hashers import make_password
from django.db import migrations, models

import apps.core.fields


def hash_existing_api_keys(apps, schema_editor):
    ApiToken = apps.get_model("core", "ApiToken")
    tokens_to_update = []
    for token in ApiToken.objects.all():
        if token.key:
            token.key_hash = make_password(token.key)
            token.key_prefix = token.key[:12]
            tokens_to_update.append(token)
    if tokens_to_update:
        ApiToken.objects.bulk_update(tokens_to_update, ["key_hash", "key_prefix"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_remove_recordattachment_attach_owner_obj_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="apitoken",
            name="key_hash",
            field=models.CharField(max_length=128, null=True),
        ),
        migrations.AddField(
            model_name="apitoken",
            name="key_prefix",
            field=models.CharField(max_length=12, db_index=True, default=""),
        ),
        migrations.RunPython(hash_existing_api_keys, noop),
        migrations.AlterField(
            model_name="apitoken",
            name="key_hash",
            field=models.CharField(max_length=128, unique=True),
        ),
        migrations.RemoveField(
            model_name="apitoken",
            name="key",
        ),
        migrations.AlterField(
            model_name="pushsubscription",
            name="p256dh",
            field=apps.core.fields.EncryptedCharField(max_length=500),
        ),
        migrations.AlterField(
            model_name="pushsubscription",
            name="auth",
            field=apps.core.fields.EncryptedCharField(max_length=500),
        ),
    ]
