from bleach import clean
from django.conf import settings


def sanitize_text(value: str | None) -> str:
    if not value:
        return ""

    return clean(
        value,
        tags=getattr(settings, "BLEACH_ALLOWED_TAGS", []),
        attributes=getattr(settings, "BLEACH_ALLOWED_ATTRIBUTES", {}),
        protocols=getattr(settings, "BLEACH_ALLOWED_PROTOCOLS", ["http", "https"]),
        strip=getattr(settings, "BLEACH_STRIP_TAGS", True),
        strip_comments=getattr(settings, "BLEACH_STRIP_COMMENTS", True),
    )