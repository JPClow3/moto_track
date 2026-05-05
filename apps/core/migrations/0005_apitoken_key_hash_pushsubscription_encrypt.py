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


def encrypt_existing_push_keys(apps, schema_editor):
    """Encrypt existing plaintext p256dh/auth before column becomes EncryptedCharField."""
    import base64

    from cryptography.fernet import Fernet
    from django.conf import settings
    from django.utils.encoding import force_bytes, force_str

    PushSubscription = apps.get_model("core", "PushSubscription")
    push_key = getattr(settings, "PUSH_ENCRYPTION_KEY", None)
    if push_key is None:
        push_key = settings.SECRET_KEY
    raw = force_bytes(push_key)
    key = base64.urlsafe_b64encode(raw[:32].ljust(32, b"0"))
    fernet = Fernet(key)

    to_update = []
    for sub in PushSubscription.objects.all().iterator():
        changed = False
        if sub.p256dh and not sub.p256dh.startswith("gAAAA"):
            sub.p256dh = force_str(fernet.encrypt(force_bytes(sub.p256dh)))
            changed = True
        if sub.auth and not sub.auth.startswith("gAAAA"):
            sub.auth = force_str(fernet.encrypt(force_bytes(sub.auth)))
            changed = True
        if changed:
            to_update.append(sub)
    if to_update:
        PushSubscription.objects.bulk_update(to_update, ["p256dh", "auth"])


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
        migrations.RunPython(encrypt_existing_push_keys, noop),
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
