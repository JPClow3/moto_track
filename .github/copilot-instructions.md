# Project Guidelines

## Product Context
Moto Track is a personal motorcycle management platform focused on low-friction daily usage.
Prioritize clear, practical flows for fuel logs, maintenance history, tire tracking, reminders, and document organization.

## Architecture
- Project type: Django monolith with modular domain apps in [apps](apps).
- Domain boundaries:
  - [apps/garage](apps/garage): Motorcycle and structured specs.
  - [apps/fuel](apps/fuel): Fuel records and consumption inputs.
  - [apps/maintenance](apps/maintenance): Service history and interval-based scheduling.
  - [apps/tires](apps/tires): Tire lifecycle and wear.
  - [apps/documents](apps/documents): Document storage and metadata.
  - [apps/reminders](apps/reminders): Date/km/interval reminder triggers.
  - [apps/reports](apps/reports): Aggregations and analytics.
  - [apps/expenses](apps/expenses): Annual fees (IPVA, DPVAT, licensing).
  - [apps/inventory](apps/inventory): Spare parts and item stock.
  - [apps/forum](apps/forum): Public articles and blog/SEO content.
  - [apps/api](apps/api): Internal REST endpoints.
  - [apps/accounts](apps/accounts): Authentication adapters (django-allauth).
  - [apps/core](apps/core): Shared base models, dashboard, cross-cutting utilities.

## Core Domain Conventions
- Reuse base abstractions from [apps/core/models.py](apps/core/models.py):
  - `TimeStampedModel`
  - `UserOwnedModel`
- User data must remain owner-scoped in views and query logic.
- Odometer is derived, not blindly persisted:
  - Use `Motorcycle.current_odometer_km` from [apps/garage/models.py](apps/garage/models.py).
  - Manual override is optional (`odometer_override_km`, `odometer_override_at`).
- Fuel records must use odometer-at-refuel and `tank_full` semantics from [apps/fuel/models.py](apps/fuel/models.py).
- Maintenance scheduling must be interval-driven (`interval_km`, `interval_days`) from [apps/maintenance/models.py](apps/maintenance/models.py), with computed next-change values.
- Reminders must use explicit trigger modeling from [apps/reminders/models.py](apps/reminders/models.py): trigger type + trigger values + references.

## Build and Validation Commands
Use Windows-friendly commands from the project root [moto_track](.).

- Environment check:
  - `./.venv/Scripts/python.exe manage.py check`
- Migrations after model changes:
  - `./.venv/Scripts/python.exe manage.py makemigrations`
  - `./.venv/Scripts/python.exe manage.py migrate`
- Ensure schema is committed:
  - `./.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`
- Frontend styles:
  - `npm install`
  - `npm run watch:css` (dev)
  - `npm run build:css` (build)

## Environment and Pitfalls
- Local default database is SQLite via `.env` (`DATABASE_URL=sqlite:///db.sqlite3`).
- Docker uses PostgreSQL; keep environment-specific `DATABASE_URL` aligned.
- After any model refactor, always generate and apply migrations before touching dependent views/admin.
- Prefer explicit migration behavior when Django rename detection is ambiguous.

## Frontend Stack (Strict — No Exceptions Without Approval)

This project's frontend stack is **locked to three technologies**. Any deviation must be explicitly justified and tagged with `AI-NOTE: justified-exception`.

| Technology | Purpose | CDN / Location |
|-----------|---------|---------------|
| **HTMX** | Server-rendered AJAX, partial page updates, form submissions | `https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js` |
| **Alpine.js** | Reactive UI state: `x-data`, `x-show`, `x-init`, `@click`, transitions | `https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js` |
| **Tailwind CSS** | All styling via utility classes | `static/css/tailwind.generated.css` (built from `static/css/input.css`) |

| Technology | Status |
|-----------|--------|
| **Chart.js** | Allowed **only** for dashboard charts, initialized via Alpine `x-init` |
| **Lucide** | Allowed for icons |
| **jQuery** | Forbidden — isolate and remove. Only tolerated for third-party deps (django-autocomplete-light) |
| **Vanilla JS in templates** | Forbidden for UI state. Allowed only for: Service Workers, Push API, Web Crypto, HTMX event glue, Chart.js init |
| **React / Vue / Svelte / Angular** | Forbidden — overkill for server-rendered Django |
| **Bootstrap / Bulma / Foundation** | Forbidden — conflicts with Tailwind |
| **Inline `<style>` blocks** | Forbidden — use Tailwind or `static/css/input.css` |
| **Inline `style="..."` attributes** | Forbidden — use Tailwind classes; dynamic numeric values (percentages) are the only exception |
| **`onclick=` / `onchange=` / `onload=`** | Forbidden — use Alpine `@click`, `@change`, `x-init` |
| **`<script>` blocks in templates for UI state** | Forbidden — use Alpine `x-data` |

### Template Rules
1. All modals, menus, snackbars, toggles, tabs, wizards use Alpine.js `x-data` + `x-show`.
2. All data fetching for partial updates uses HTMX `hx-get` / `hx-post`.
3. On HTMX swaps that inject Alpine directives, call `Alpine.initTree(targetElement)` in `htmx:afterSwap`.
4. Use `[x-cloak] { display: none !important; }` in `<head>` to prevent Alpine flicker.

### Justification Tags
If vanilla JS or a forbidden technology is genuinely required, tag the code:
```html
<!-- AI-NOTE: justified-exception — ServiceWorker registration requires imperative JS -->
```

## UI and Accessibility Conventions
- Keep templates server-rendered and simple first; use HTMX and Alpine.js for interactivity.
- Preserve semantic landmarks and keyboard support patterns already present in [templates/base.html](templates/base.html).
- Maintain visible focus states and descriptive labels for forms and interactive elements.

## Reference Docs
- Setup and runtime overview: [README.md](README.md)
- Settings split and runtime config: [config/settings/base.py](config/settings/base.py), [config/settings/dev.py](config/settings/dev.py), [config/settings/prod.py](config/settings/prod.py)
