"""OpenTelemetry SDK bootstrap.

Imported from `config/wsgi.py` and `config/celery.py` so traces are wired up
exactly once per process *before* Django apps are loaded. The setup is gated
on `OTEL_EXPORTER_OTLP_ENDPOINT` being set: when the observability stack is
not running (dev, tests, CI), this module is a complete no-op and pulls
in no third-party imports beyond the stdlib check.

Sentry is left alone — it stays as the primary error-tracking surface. OTel
traces ship to Tempo via Alloy so the Grafana side gets a unified view.
"""

from __future__ import annotations

import logging
import os

_logger = logging.getLogger(__name__)
_initialized = False


def setup() -> None:
    global _initialized
    if _initialized:
        return

    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not endpoint:
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.celery import CeleryInstrumentor
        from opentelemetry.instrumentation.django import DjangoInstrumentor
        from opentelemetry.instrumentation.logging import LoggingInstrumentor
        from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        from opentelemetry.instrumentation.requests import RequestsInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        # The deps live in requirements/base.txt but if someone runs an old
        # virtualenv we'd rather log and continue than crash the worker.
        _logger.warning("OTEL_EXPORTER_OTLP_ENDPOINT set but opentelemetry packages missing; skipping trace setup.")
        return

    service_name = os.environ.get("OTEL_SERVICE_NAME", "moto-track")
    deploy_env = (
        os.environ.get("SENTRY_ENVIRONMENT")
        or os.environ.get("OTEL_DEPLOYMENT_ENVIRONMENT")
        or ("development" if os.environ.get("DJANGO_DEBUG") == "1" else "production")
    )
    release = os.environ.get("APP_BUILD_ID", "dev")

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.version": release,
            "deployment.environment": deploy_env,
        }
    )

    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint.rstrip('/')}/v1/traces")))
    trace.set_tracer_provider(provider)

    # Instrument frameworks. `is_sites_framework_disabled=True` keeps Django's
    # ALLOWED_HOSTS warning quiet for the metrics scrape path.
    DjangoInstrumentor().instrument(is_sites_framework_disabled=True)
    CeleryInstrumentor().instrument()
    Psycopg2Instrumentor().instrument(enable_commenter=True, commenter_options={})
    RedisInstrumentor().instrument()
    RequestsInstrumentor().instrument()
    # Inject trace_id/span_id into log records so Loki entries can be joined to
    # the same trace in Grafana via the "Logs to traces" datasource link.
    LoggingInstrumentor().instrument(set_logging_format=False)

    _initialized = True
    _logger.info("OpenTelemetry trace pipeline initialized (endpoint=%s env=%s)", endpoint, deploy_env)
