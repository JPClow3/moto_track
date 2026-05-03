# Moto Track

## Your motorcycle's command center

**Fuel · Maintenance · Tires · Documents · Expenses — all in one dashboard.**

[![Django](https://img.shields.io/badge/Django-5.x-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![HTMX](https://img.shields.io/badge/HTMX-2.x-3366CC?logo=htmx&logoColor=white)](https://htmx.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Private-gray)](https://github.com/JPClow3/moto_track)

---

Moto Track is a personal motorcycle management platform built for riders who want **one place** to track fuel economy, schedule maintenance, monitor tire wear, store documents, and visualize costs — no spreadsheets, no scattered notes, no clutter.

> *"Ride more. Worry less. Let the dashboard handle the rest."*

---

## What You Get

### Ride & Cost Tracking

- Real-time fuel economy (km/L, cost/km)
- Maintenance history with interval alerts
- Annual expenses (registration, insurance, taxes)
- Tire lifecycle & wear monitoring

### Organization & Insights

- Document vault (license, insurance, receipts)
- Smart reminders by date, km, or interval
- Parts inventory management
- Cost evolution charts & health score

**Plus:** public blog/guides for SEO, REST API, Google OAuth, PWA install prompt, dark mode, and full accessibility (keyboard + screen reader).

---

## Modules

| Module | Description |
| :--- | :--- |
| **Dashboard** | Live overview — recent events, alerts, health score |
| **Garage** | Motorcycle profiles, specs, and odometer tracking |
| **Fuel** | Fill-up history, consumption trends, price tracking |
| **Maintenance** | Service records, parts used, preventive intervals |
| **Tires** | Structured catalog, installation & wear history |
| **Documents** | File attachments with metadata (license, insurance, manual) |
| **Reminders** | Trigger-based alerts (date, km, interval) |
| **Expenses** | Annual taxes & fees (IPVA, DPVAT, licensing) |
| **Inventory** | Spare parts & maintenance items stock |
| **Reports** | Cost evolution, usage trends, data visualizations |
| **Blog** | Public articles & guides (SEO-ready) |
| **API** | REST endpoints for core data |

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Django 5 · django-environ · django-money · django-bleach · django-autocomplete-light |
| **Auth** | django-allauth + allauth-ui · Google OAuth |
| **Frontend** | Tailwind CSS · HTMX · Alpine.js · Chart.js · Lucide Icons |
| **Forms** | django-crispy-forms + crispy-tailwind · django-cotton |
| **Database** | SQLite (dev) · PostgreSQL (prod) |
| **Infra** | Docker · Gunicorn · Caddy/Nginx · S3 (media) · WhiteNoise (static) |
| **Monitoring** | Sentry (errors + tracing + profiling) |
| **CI/CD** | GitHub Actions · pytest · Bandit · pip-audit |

> **Frontend philosophy:** server-rendered HTML with progressive enhancement. No SPA frameworks — just HTMX for AJAX, Alpine.js for reactive state, and Tailwind for styling. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full rules.

---

## Quick Start

### Without Docker

```bash
pip install -r requirements/dev.txt
cp .env.example .env
npm install
python manage.py migrate
npm run watch:css          # Terminal 1 — live CSS rebuild
python manage.py runserver # Terminal 2 — dev server
```

### With Docker

```bash
cp .env.example .env
docker compose --profile dev up --build
docker compose --profile dev exec web python manage.py migrate
```

### With Docker + HTTPS (self-hosted VPS)

```bash
cp .env.example .env
# Set: SITE_DOMAIN, DJANGO_ALLOWED_HOSTS, DJANGO_SECRET_KEY,
#      AWS_STORAGE_BUCKET_NAME, POSTGRES_PASSWORD
docker compose --profile prod --profile edge up -d --build
```

Caddy auto-provisions TLS certificates — ports `80/443` exposed, `www` redirects to apex.

> Open **<http://localhost:8000>** after starting.

---

## First Login

```bash
python manage.py createadmin    # No-prompt superuser
python manage.py createsuperuser # Standard Django alternative
```

Login at `/accounts/login/` · Admin panel at `/admin/`.

---

## Demo Data

```bash
python manage.py seed_demo_data
```

Idempotently creates: demo user, motorcycle, specs, gas station, fuel type, fill-up, maintenance record, tire, reminder, and sample document.

---

## Project Structure

```text
apps/
  core/         Dashboard, base models, shared utilities
  garage/       Motorcycle profiles & structured specs
  fuel/         Fill-ups, gas stations & fuel types
  maintenance/  Service records, parts & recurring items
  tires/        Tire catalog & installation history
  documents/    Document vault & file attachments
  reminders/    Trigger-based alerts
  reports/      Aggregations & KPIs
  expenses/     Annual taxes & fees
  inventory/    Parts stock management
  forum/        Public blog & articles
  api/          REST API endpoints
  accounts/     Authentication (django-allauth)
```

---

## Business Rules

- All data is **owner-scoped** — users only see their own records.
- Odometer is **derived from history**; manual override is optional.
- Fill-ups require mileage, liters, total cost, and a `tank_full` flag.
- Maintenance intervals track both **km** and **days**.
- Reminders use explicit trigger types (date, km, interval).
- Catalogs (stations, parts, tires) are **reusable** to reduce repeated input.

---

## Verification

```bash
npm run build:css
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

---

## Deploy

Full guide: **[docs/deploy.md](docs/deploy.md)**

| Path | Command |
| :--- | :--- |
| **Coolify / managed proxy** | `docker compose --profile prod up -d` |
| **Self-hosted VPS (Caddy TLS)** | `docker compose --profile prod --profile edge up -d --build` |
| **Bare metal (Nginx + Gunicorn)** | See [deploy.md](docs/deploy.md) for systemd + Nginx setup |

---

## Roadmap

> These features are **planned** — none are implemented yet.

| Feature | Description |
| :--- | :--- |
| **Receipt OCR** | Scan fuel receipts to auto-fill station, liters, and cost via Google Vision / AWS Textract |
| **Shareable Dossier** | Generate a temporary public URL for mechanics or buyers to review full bike history |
| **AI Maintenance Prediction** | Use monthly riding averages to predict the approximate date of the next service |
| **Parts Marketplace Integration** | Link recommended parts to Amazon / Mercado Livre searches from maintenance history |

---

## Accessibility

The interface maintains visible focus indicators, semantic landmarks, and descriptive labels. Designed for comfortable use with keyboards and screen readers. Periodic manual audits are still recommended.

---

> *Built with caffeine and two wheels.*
