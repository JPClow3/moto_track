import hashlib

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.db import IntegrityError, models, transaction
from django.utils.crypto import get_random_string

from apps.core.fields import EncryptedCharField


def _is_unique_violation(exc: IntegrityError) -> bool:
    """Best-effort check that an IntegrityError is from a UNIQUE constraint.

    Django doesn't expose a structured exception type for this; we check the
    message across the SQLite/Postgres dialects we run on.
    """
    msg = str(exc).lower()
    return "unique" in msg or "duplicate" in msg


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

    # B-C3: prevent _plaintext_key from leaking via debugger / Sentry / pickle.
    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<ApiToken pk={self.pk} name={self.name!r} prefix={self.key_prefix!r}>"

    def __getstate__(self):
        state = self.__dict__.copy()
        state.pop("_plaintext_key", None)
        return state

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
                except IntegrityError as exc:
                    # B-M5: only swallow IntegrityError when it actually looks
                    # like the unique-constraint we are retrying for. Anything
                    # else (FK violation, NOT NULL, etc.) is re-raised.
                    if not _is_unique_violation(exc):
                        raise
                    if attempt == 4:
                        raise RuntimeError("Failed to generate a unique API key after 5 attempts.") from exc
                    self.key_hash = ""
                    self.key_prefix = ""
        else:
            super().save(*args, **kwargs)

class SiteSettings(models.Model):
    CACHE_KEY = "core:site-settings"
    CACHE_MISS = False

    company_name = models.CharField(max_length=200, default="Moto Track")
    cnpj = models.CharField("CNPJ", max_length=20, blank=True, default="")
    support_email = models.EmailField(default="suporte@moto-track.net")
    support_phone = models.CharField(max_length=30, blank=True, default="")
    support_whatsapp = models.CharField(max_length=30, blank=True, default="")
    address_street = models.CharField(max_length=300, blank=True, default="")
    address_city = models.CharField(max_length=100, blank=True, default="")
    address_state = models.CharField(max_length=2, blank=True, default="")
    address_zip = models.CharField("CEP", max_length=10, blank=True, default="")
    dpo_name = models.CharField("Encarregado de Dados (DPO)", max_length=200, blank=True, default="")
    dpo_email = models.EmailField("E-mail do DPO", blank=True, default="")
    terms_last_updated = models.DateField("Termos atualizados em", null=True, blank=True)
    privacy_last_updated = models.DateField("Privacidade atualizada em", null=True, blank=True)
    lgpd_last_updated = models.DateField("LGPD atualizada em", null=True, blank=True)
    cancellation_last_updated = models.DateField("Cancelamento atualizado em", null=True, blank=True)

    class Meta:
        verbose_name = "Configurações do Site"
        verbose_name_plural = "Configurações do Site"

    def __str__(self) -> str:
        return "Configurações do Site"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        cache.delete(self.CACHE_KEY)

    def delete(self, *args, **kwargs):
        cache.delete(self.CACHE_KEY)
        return super().delete(*args, **kwargs)

    @classmethod
    def load(cls):
        obj = cls.objects.filter(pk=1).first()
        return obj if obj is not None else cls(pk=1)

    @classmethod
    def get_cached(cls):
        cached = cache.get(cls.CACHE_KEY, None)
        if cached is cls.CACHE_MISS:
            return None
        if cached is not None:
            return cached
        obj = cls.objects.filter(pk=1).first()
        cache.set(cls.CACHE_KEY, obj if obj is not None else cls.CACHE_MISS, 300)
        return obj


def _hash_endpoint(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode("utf-8")).hexdigest() if endpoint else ""


class PushSubscription(TimeStampedModel):
    # B-M10: endpoint URL identifies a user's push channel and must not leak in
    # plaintext. We encrypt the URL itself and keep a SHA-256 hash for lookups
    # and the (owner, endpoint) uniqueness contract.
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = EncryptedCharField(max_length=600)
    endpoint_hash = models.CharField(max_length=64, db_index=True, default="")
    p256dh = EncryptedCharField(max_length=500)
    auth = EncryptedCharField(max_length=500)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "endpoint_hash"], name="core_push_owner_endpoint_hash_uniq"),
        ]

    def __str__(self) -> str:
        return f"Subscription for {self.owner} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        if self.endpoint:
            self.endpoint_hash = _hash_endpoint(self.endpoint)
        super().save(*args, **kwargs)


class ClientSubmission(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="client_submissions")
    token = models.CharField(max_length=80)
    action = models.CharField(max_length=80)
    result_model = models.CharField(max_length=120, blank=True, default="")
    result_pk = models.PositiveBigIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "token"], name="core_client_submission_owner_token_uniq"),
        ]

    def __str__(self) -> str:
        return f"{self.action}:{self.token}"
