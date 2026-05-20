# Observability — Grafana Cloud + Alloy

This document is the runbook for the observability stack. The system covers
**metrics**, **logs**, **traces**, and **synthetic uptime checks**, all in one
Grafana Cloud workspace. Sentry stays as the primary error-tracking surface;
OTel traces feed Tempo so the Grafana side has a unified view.

## Architecture

```
Django web ──┐
Celery worker┤── /internal/metrics/ + OTLP traces ──► Alloy ──► Grafana Cloud
postgres-exporter, redis-exporter, celery-exporter, cadvisor ─┘   (Prom + Loki + Tempo)

Caddy ──► drops /internal/* with 404 (so /metrics is not public)
Grafana Cloud Synthetic Monitoring ──► probes /healthz/ from outside
```

One `alloy` container is the single egress point. It:

- scrapes Prometheus targets on the docker network every 30s,
- tails container stdout via the docker socket and ships to Loki,
- receives OTLP traces on `:4317` (gRPC) and `:4318` (HTTP) and ships to Tempo,
- authenticates to all three sinks with a single Access Policy token.

## First-time setup

### 1. Grafana Cloud account

1. Sign up at https://grafana.com (the free tier covers everything below).
2. Open your stack → **Connections** → and copy the remote-write endpoints +
   numeric usernames for **Prometheus**, **Loki**, and **Tempo**. Put them in
   `.env` as documented in `.env.example`.
3. Open **Administration → Users and access → Access Policies** → create one
   policy with scopes `metrics:write logs:write traces:write`. Generate a
   token under that policy and store as `GRAFANA_CLOUD_API_KEY`.

### 2. Boot the stack

```bash
docker compose --profile prod --profile observability up -d
```

Verify within a couple of minutes:

```bash
docker compose logs alloy | tail -50
# Look for: "scrape_pool=infra ... msg='scrape completed'" lines
# and:      "loki.write: pushed X entries"
```

In Grafana Cloud, **Explore → Prometheus**, run:

```promql
up{env="production"}
```

You should see one `up=1` series per job: `django`, `postgres`, `redis`,
`celery`, `cadvisor`, `alloy`.

### 3. Synthetic check

In Grafana Cloud, **Synthetic Monitoring → New check**:

- type: **HTTP**
- URL: `https://<your-domain>/healthz/`
- frequency: 1 minute
- probes: pick 3 regions
- alert sensitivity: medium

This catches outages when the app itself can't report.

### 4. Dashboards

Import these community dashboards via **Dashboards → New → Import**:

| Dashboard         | ID    | Notes                                        |
|-------------------|-------|----------------------------------------------|
| Django Prometheus | 9528  | Per-view RED metrics from `django-prometheus`|
| Celery            | 17508 | Queue depth + task durations                 |
| Postgres          | 9628  | Connections, slow queries, replication lag   |
| Redis             | 763   | Memory, hits, evictions                      |
| cAdvisor          | 14282 | Per-container CPU/RAM                        |

The custom dashboard for moto_track business metrics lives at
`deploy/grafana/dashboards/business.json`. Import it the same way.

## Metric catalog

App-level metrics defined in `apps/core/metrics.py`. Cardinality kept low on
purpose (Grafana Cloud free tier caps at 10k active series).

| Metric                                    | Type      | Labels                          |
|-------------------------------------------|-----------|---------------------------------|
| `moto_signups_total`                      | counter   | `method` (password/google)      |
| `moto_stripe_webhook_total`               | counter   | `event_type`, `outcome`         |
| `moto_stripe_webhook_duration_seconds`    | histogram | `event_type`                    |
| `moto_reminders_run_total`                | counter   | `outcome` (success/error)       |
| `moto_reminders_processed_total`          | counter   | `action` (due/emailed/marked)   |
| `moto_reminders_run_duration_seconds`     | histogram | —                               |

Plus the framework metrics shipped by `django-prometheus`:
`django_http_requests_total_by_method_total`,
`django_http_responses_total_by_status_total`,
`django_http_requests_latency_seconds_by_view_method_bucket`, etc.

## Useful queries

**Error rate per view (last 5 min)**

```promql
sum by (view) (
  rate(django_http_responses_total_by_status_view_method_total{status=~"5..", env="production"}[5m])
)
```

**p95 webhook latency by event type**

```promql
histogram_quantile(0.95,
  sum by (event_type, le) (rate(moto_stripe_webhook_duration_seconds_bucket[5m]))
)
```

**Celery queue depth**

```promql
celery_queue_length{queue="celery"}
```

**Find logs for a specific request_id (Loki)**

```logql
{service="web-prod"} | request_id="abc123"
```

## Operational notes

- **Costs.** Free tier = 10k active series, 50 GB logs, 50 GB traces / month.
  Our scrape interval is 30s; the current metric catalog fits easily.
- **Token rotation.** Rotate `GRAFANA_CLOUD_API_KEY` every 90 days. Create the
  new token, update `.env`, `docker compose --profile observability up -d alloy`
  to restart only Alloy, then revoke the old token.
- **Disabling the stack.** Don't run with `--profile observability` and the
  Django app still works exactly as before — `/internal/metrics/` is still
  exposed inside the container but is never scraped and Caddy 404s it from
  outside. OTel SDK silently drops spans when Alloy isn't there.
- **Don't expose `/internal/metrics/`.** Caddy blocks `/internal/*` with a 404.
  If you change the URL prefix, update the Caddyfile too.
- **Sentry coexistence.** Both Sentry and Tempo receive traces. They use
  different sampling — Sentry's `SENTRY_TRACES_SAMPLE_RATE` is independent of
  OTel. If trace volume becomes an issue, lower Sentry's rate first; Tempo is
  cheaper.
