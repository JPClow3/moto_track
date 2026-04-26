from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, models, transaction
from django.utils.crypto import get_random_string

from apps.core.fields import EncryptedCharField


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UserOwnedModel(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_%(app_label)s_%(class)ss",
    )

    class Meta:
        abstract = True


def generate_api_key() -> str:
    return get_random_string(48)


_generate_api_key = generate_api_key  # backward-compat alias for migration 0001_initial.py


def validate_attachment_file(file_obj):
    """Stub for migration 0001_initial.py backward compatibility."""
    pass


class ApiToken(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_tokens")
    name = models.CharField(max_length=120)
    key_hash = models.CharField(max_length=128, unique=True)
    key_prefix = models.CharField(max_length=12, db_index=True, default="")
    scopes = models.CharField(max_length=240, blank=True, help_text="Escopos separados por espaço, ex: fuel:read")
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    _plaintext_key = None

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def has_scope(self, scope: str) -> bool:
        configured = {part.strip() for part in self.scopes.split() if part.strip()}
        return "*" in configured or scope in configured

    @property
    def key(self):
        if self._plaintext_key is None:
            raise RuntimeError(
                "API key is only available immediately after creation. Store it securely."
            )
        return self._plaintext_key

    def save(self, *args, **kwargs):
        if not self.key_hash:
            for attempt in range(5):
                raw_key = generate_api_key()
                self.key_hash = make_password(raw_key)
                self.key_prefix = raw_key[:12]
                self._plaintext_key = raw_key
                try:
                    with transaction.atomic():
                        super().save(*args, **kwargs)
                    return
                except IntegrityError:
                    if attempt == 4:
                        raise RuntimeError("Failed to generate a unique API key after 5 attempts.")
                    self.key_hash = ""
                    self.key_prefix = ""
        else:
            super().save(*args, **kwargs)

class PushSubscription(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=500)
    p256dh = EncryptedCharField(max_length=500)
    auth = EncryptedCharField(max_length=500)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "endpoint"], name="core_push_owner_endpoint_uniq"),
        ]

    def __str__(self) -> str:
        return f"Subscription for {self.owner} ({self.created_at.date()})"
