# B-M10: encrypt PushSubscription.endpoint at rest. We add a SHA-256 hash
# column for lookups + uniqueness, encrypt the URL itself, and swap the
# (owner, endpoint) unique constraint for (owner, endpoint_hash).

import hashlib

from django.db import migrations, models

import apps.core.fields


def populate_endpoint_hash_and_encrypt(apps, schema_editor):
    import base64

    from cryptography.fernet import Fernet
    from django.conf import settings
    from django.utils.encoding import force_bytes, force_str

    PushSubscription = apps.get_model("core", "PushSubscription")
    push_key = getattr(settings, "PUSH_ENCRYPTION_KEY", None) or settings.SECRET_KEY
    raw = force_bytes(push_key)
    key = base64.urlsafe_b64encode(raw[:32].ljust(32, b"0"))
    fernet = Fernet(key)

    to_update = []
    for sub in PushSubscription.objects.all().iterator():
        plaintext = sub.endpoint or ""
        if not plaintext:
            continue
        # If we're being re-run on already-encrypted data (Fernet tokens start
        # with the magic "gAAAA"), skip the encryption step but still ensure
        # the hash column is populated.
        if plaintext.startswith("gAAAA"):
            try:
                plaintext = force_str(fernet.decrypt(force_bytes(plaintext)))
            except Exception:
                continue
        else:
            sub.endpoint = force_str(fernet.encrypt(force_bytes(plaintext)))
        sub.endpoint_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
        to_update.append(sub)
    if to_update:
        PushSubscription.objects.bulk_update(to_update, ["endpoint", "endpoint_hash"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_clientsubmission"),
    ]

    operations = [
        migrations.AddField(
            model_name="pushsubscription",
            name="endpoint_hash",
            field=models.CharField(db_index=True, default="", max_length=64),
        ),
        migrations.RunPython(populate_endpoint_hash_and_encrypt, noop),
        migrations.RemoveConstraint(
            model_name="pushsubscription",
            name="core_push_owner_endpoint_uniq",
        ),
        migrations.AlterField(
            model_name="pushsubscription",
            name="endpoint",
            field=apps.core.fields.EncryptedCharField(max_length=600),
        ),
        migrations.AddConstraint(
            model_name="pushsubscription",
            constraint=models.UniqueConstraint(
                fields=("owner", "endpoint_hash"),
                name="core_push_owner_endpoint_hash_uniq",
            ),
        ),
    ]
