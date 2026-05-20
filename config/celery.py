from __future__ import annotations

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# Initialize OpenTelemetry before Celery starts so CeleryInstrumentor can
# subscribe to the worker signals. No-op when OTEL_EXPORTER_OTLP_ENDPOINT
# is unset (dev/test).
from config import otel  # noqa: E402

otel.setup()

app = Celery("moto_track")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
