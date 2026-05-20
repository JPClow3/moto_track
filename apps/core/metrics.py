"""Application-level Prometheus metrics.

Every metric defined here is automatically exposed at /internal/metrics/ via
django-prometheus' shared registry — `prometheus_client.Counter`/`Histogram`
register on the default registry that django-prometheus serves.

Naming follows the Prometheus convention `<namespace>_<noun>_<unit>`:
  - Counters end in `_total` (rate() works correctly only on counters that
    monotonically increase).
  - Histograms end in `_seconds` for durations.
  - Labels are LOW cardinality. Never label with user IDs, request paths, or
    anything unbounded — that explodes the time-series count and burns the
    Grafana Cloud free-tier quota.
"""

from __future__ import annotations

from prometheus_client import Counter, Histogram

# ---------------------------------------------------------------------------
# Auth / accounts
# ---------------------------------------------------------------------------
signups_total = Counter(
    "moto_signups_total",
    "User signups, partitioned by method.",
    labelnames=("method",),  # "password" | "google"
)

# ---------------------------------------------------------------------------
# Billing / Stripe
# ---------------------------------------------------------------------------
stripe_webhook_total = Counter(
    "moto_stripe_webhook_total",
    "Stripe webhook events received, partitioned by event type and outcome.",
    labelnames=("event_type", "outcome"),  # outcome: processed | duplicate | error
)

stripe_webhook_duration_seconds = Histogram(
    "moto_stripe_webhook_duration_seconds",
    "Stripe webhook processing latency in seconds.",
    labelnames=("event_type",),
    # Coarse buckets — webhook handling should be sub-second; anything above
    # 5s indicates a degraded DB or a runaway query.
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# ---------------------------------------------------------------------------
# Reminders (Celery beat job)
# ---------------------------------------------------------------------------
reminders_run_total = Counter(
    "moto_reminders_run_total",
    "Reminder-processing job runs, partitioned by outcome.",
    labelnames=("outcome",),  # "success" | "error"
)

reminders_processed_total = Counter(
    "moto_reminders_processed_total",
    "Individual reminder rows acted on, partitioned by action.",
    labelnames=("action",),  # "due" | "emailed" | "marked"
)

reminders_run_duration_seconds = Histogram(
    "moto_reminders_run_duration_seconds",
    "Reminder job wall-clock duration.",
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0),
)
