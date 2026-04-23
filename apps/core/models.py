from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.crypto import get_random_string


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


def validate_attachment_file(file_obj):
    if not file_obj:
        return

    max_size = 15 * 1024 * 1024
    if file_obj.size and file_obj.size > max_size:
        raise ValidationError("O anexo deve ter no máximo 15 MB.")

    name = (file_obj.name or "").lower()
    allowed_extensions = (".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic", ".doc", ".docx")
    if not name.endswith(allowed_extensions):
        raise ValidationError("Envie anexo em imagem, PDF ou documento.")


class RecordAttachment(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="record_attachments")
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    file = models.FileField(upload_to="attachments/%Y/%m/", validators=[validate_attachment_file])
    label = models.CharField(max_length=140, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "content_type", "object_id"], name="attach_owner_obj_idx"),
        ]

    def __str__(self) -> str:
        return self.label or self.file.name


def _generate_api_key() -> str:
    return get_random_string(48)


class ApiToken(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_tokens")
    name = models.CharField(max_length=120)
    key = models.CharField(max_length=64, unique=True, default=_generate_api_key)
    scopes = models.CharField(max_length=240, blank=True, help_text="Escopos separados por espaço, ex: fuel:read")
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def has_scope(self, scope: str) -> bool:
        configured = {part.strip() for part in self.scopes.split() if part.strip()}
        return "*" in configured or scope in configured

class PushSubscription(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=500)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=200)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "endpoint"], name="core_push_owner_endpoint_uniq"),
        ]

    def __str__(self) -> str:
        return f"Subscription for {self.owner} ({self.created_at.date()})"
