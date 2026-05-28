from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.garage.models import Motorcycle


class SaleReportShare(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sale_report_shares")
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.CASCADE, related_name="sale_report_shares")
    token_hash = models.CharField(max_length=64, unique=True)
    token_prefix = models.CharField(max_length=12, db_index=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    access_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "motorcycle", "expires_at"], name="sale_share_owner_moto_exp_idx"),
            models.Index(fields=["token_prefix"], name="sale_share_token_prefix_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.motorcycle.name} share {self.token_prefix}"

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @classmethod
    def create_for(cls, *, motorcycle: Motorcycle, owner, days: int = 14):
        token = secrets.token_urlsafe(32)
        share = cls.objects.create(
            owner=owner,
            motorcycle=motorcycle,
            token_hash=cls.hash_token(token),
            token_prefix=token[:12],
            expires_at=timezone.now() + timedelta(days=days),
        )
        return share, token

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at >= timezone.now()

    def revoke(self) -> None:
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=["revoked_at", "updated_at"])
