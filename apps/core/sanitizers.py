import nh3
from django.conf import settings


def sanitize_text(value: str | None) -> str:
    if not value:
        return ""

    tags = set(getattr(settings, "BLEACH_ALLOWED_TAGS", []) or [])
    return nh3.clean(value, tags=tags)
