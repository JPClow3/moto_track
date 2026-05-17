# B-M10: encrypt PushSubscription.endpoint at rest. We add a SHA-256 hash
# column for lookups + uniqueness, encrypt the URL itself, and swap the
# (owner, endpoint) unique constraint for (owner, endpoint_hash).
#
# Operation order is load-bearing:
#   1. AddField endpoint_hash (default "" so existing rows are valid).
#   2. RemoveConstraint on the old (owner, endpoint) unique pair so we can
#      mutate endpoint values freely during backfill.
#   3. AlterField endpoint -> EncryptedCharField(max_length=1000). The column
#      MUST be resized BEFORE we write ciphertext into it, otherwise the
#      Fernet token (≈1.33 * plaintext + 80 chars) overflows the old
#      varchar(500) on Postgres and aborts the deploy.
#   4. RunPython backfill: encrypt plaintext + populate endpoint_hash. Streams
#      with .iterator() and flushes every 1000 rows so memory stays bounded
#      on large tables.
#   5. AddConstraint on the new (owner, endpoint_hash) pair.

import hashlib

from django.db import migrations, models

import apps.core.fields

_BATCH_SIZE = 1000


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

    def _flush(batch):
        if batch:
            PushSubscription.objects.bulk_update(batch, ["endpoint", "endpoint_hash"])

    to_update = []
    for sub in PushSubscription.objects.all().iterator(chunk_size=_BATCH_SIZE):
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
        if len(to_update) >= _BATCH_SIZE:
            _flush(to_update)
            to_update = []
    _flush(to_update)


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
        # Drop the old uniqueness contract first so the backfill is unrestricted.
        migrations.RemoveConstraint(
            model_name="pushsubscription",
            name="core_push_owner_endpoint_uniq",
        ),
        # Resize / retype the column BEFORE we write ciphertext into it.
        migrations.AlterField(
            model_name="pushsubscription",
            name="endpoint",
            field=apps.core.fields.EncryptedCharField(max_length=1000),
        ),
        migrations.RunPython(populate_endpoint_hash_and_encrypt, noop),
        migrations.AddConstraint(
            model_name="pushsubscription",
            constraint=models.UniqueConstraint(
                fields=("owner", "endpoint_hash"),
                name="core_push_owner_endpoint_hash_uniq",
            ),
        ),
    ]
