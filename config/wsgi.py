import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.getenv("DJANGO_SETTINGS_MODULE", "config.settings.prod"))

# Initialize OpenTelemetry BEFORE Django loads so DjangoInstrumentor can patch
# request handling at import time. No-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset.
from config import otel  # noqa: E402

otel.setup()

application = get_wsgi_application()
