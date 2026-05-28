# Documentation Map

Use this directory for operational, architecture, and strategy notes. To keep
things from drifting, each topic has one primary source of truth.

## Canonical Entry Points

| Topic | Primary source | Notes |
| --- | --- | --- |
| Product overview, setup, validation | [README.md](../README.md) | Start here for local development and everyday repo workflows. |
| Frontend contribution rules | [CONTRIBUTING.md](../CONTRIBUTING.md) | Authoritative HTMX/Alpine/Tailwind guidance. |
| Runtime environment variables | [`.env.example`](../.env.example) | Canonical list of local, Docker, production, and observability settings. |
| Deployment flows | [deploy.md](deploy.md) | Primary Dokploy-on-EC2 path plus direct Compose and manual VM fallbacks. |
| Observability runbook | [observability.md](observability.md) | Grafana Cloud + Alloy setup, dashboards, and verification. |
| Backup and recovery | [BACKUP.md](BACKUP.md) | Backup policy, restore steps, and recovery objectives. |
| Restore drill history | [drills.md](drills.md) | Append quarterly drill outcomes here. |

## Architecture Decisions

The ADRs in [adr/](adr/) capture why major technical choices were made:

- [0001: Server-rendered HTMX stack](adr/0001-server-rendered-htmx-stack.md)
- [0002: Stripe billing webhook idempotency](adr/0002-stripe-billing-webhook-idempotency.md)

## Product Strategy

- [mobile-and-monetization-strategy.md](mobile-and-monetization-strategy.md)

This file is intentionally an index. Detailed instructions should live in the
topic-specific document above instead of being duplicated here.
