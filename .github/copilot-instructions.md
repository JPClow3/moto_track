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

## UI and Accessibility Conventions
- Keep templates server-rendered and simple first; use HTMX (and small vanilla JS) only where it reduces friction.
- Preserve semantic landmarks and keyboard support patterns already present in [templates/base.html](templates/base.html).
- Maintain visible focus states and descriptive labels for forms and interactive elements.

## Reference Docs
- Setup and runtime overview: [README.md](README.md)
- Settings split and runtime config: [config/settings/base.py](config/settings/base.py), [config/settings/dev.py](config/settings/dev.py), [config/settings/prod.py](config/settings/prod.py)
