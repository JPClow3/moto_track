from __future__ import annotations

import base64

from django.conf import settings
from django.db import models
from django.utils.encoding import force_bytes, force_str
from cryptography.fernet import Fernet


def _get_fernet():
    raw = force_bytes(getattr(settings, "PUSH_ENCRYPTION_KEY", settings.SECRET_KEY))
    key = base64.urlsafe_b64encode(raw[:32].ljust(32, b"0"))
    return Fernet(key)


class EncryptedCharField(models.CharField):
    """CharField that encrypts values at rest using Fernet (from SECRET_KEY)."""

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        try:
            return force_str(_get_fernet().decrypt(force_bytes(value)))
        except Exception:
            return value

    def to_python(self, value):
        if isinstance(value, str) or value is None:
            return value
        return force_str(value)

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None:
            return value
        return force_str(_get_fernet().encrypt(force_bytes(value)))
